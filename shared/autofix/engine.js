const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const simpleGit = require('simple-git');
const PatchRequest = require('../models/PatchRequest');
const PRRun = require('../models/PRRun');
const { transformers, commentOut, getCommentSyntax, ensureAsyncAroundLine } = require('./transformers');
const logger = require('../utils/prettyLogger');
const { rewriteFileWithAI, planMinimalFixesWithAI } = require('../llm/rewrite');
const crypto = require('crypto');

function safeRepoUrl(repo) {
  const token = process.env.GITHUB_TOKEN;
  if (token) return `https://x-access-token:${token}@github.com/${repo}.git`;
  return `https://github.com/${repo}.git`;
}

function buildMarkers(file, findingId, meta) {
  const syntax = getCommentSyntax(file);
  const labelStart = `PEER-AUTOFIX start [findingId=${findingId} rule=${meta.rule} analyzer=${meta.analyzer} ts=${Date.now()}]`;
  const labelEnd = `PEER-AUTOFIX end [findingId=${findingId}]`;
  if (syntax.line) {
    return { head: `${syntax.line}${labelStart}`, tail: `${syntax.line}${labelEnd}` };
  }
  // block comments
  return { head: `${syntax.blockStart}${labelStart}${syntax.blockEnd}`, tail: `${syntax.blockStart}${labelEnd}${syntax.blockEnd}` };
}

function toUnifiedDiff(file, originalLines, newLines) {
  // Minimal unified diff for preview (one hunk per file replacement set)
  const header = `--- a/${file}\n+++ b/${file}`;
  // Compute naive hunk by scanning line-by-line and marking changed lines
  const hunks = [];
  for (let i = 0; i < Math.max(originalLines.length, newLines.length); i++) {
    const a = originalLines[i] ?? '';
    const b = newLines[i] ?? '';
    if (a !== b) hunks.push({ i, a, b });
  }
  if (hunks.length === 0) return `${header}\n`;
  let out = `${header}\n@@ -1,${originalLines.length} +1,${newLines.length} @@\n`;
  for (let i = 0; i < Math.max(originalLines.length, newLines.length); i++) {
    const a = originalLines[i];
    const b = newLines[i];
    if (a === b) out += ` ${a ?? ''}\n`;
    else {
      if (typeof a !== 'undefined') out += `-${a}\n`;
      if (typeof b !== 'undefined') out += `+${b}\n`;
    }
  }
  return out;
}

function selectTransformer(rule) {
  return transformers.find(t => t.rule === rule) || null;
}

function applyLineTransform(file, lines, lineNumber, finding) {
  const idx = (lineNumber || 1) - 1;
  if (idx < 0 || idx >= lines.length) return { ok: false, reason: 'line_out_of_range' };
  const original = lines[idx];
  const t = selectTransformer(finding.rule);
  if (!t) return { ok: false, reason: 'no_transformer' };
  const changed = t.apply(original);
  if (!changed) return { ok: false, reason: 'not_applicable' };

  // If async required for JS/TS, ensure containing function is async
  let workingLines = [...lines];
  if (changed.requiresAsync) {
    const ensured = ensureAsyncAroundLine(file, workingLines, idx);
    workingLines = ensured.lines;
  }

  const { head, tail } = buildMarkers(file, finding._id || finding.id || String(Math.random()), finding);
  const commented = commentOut(original, file);
  const inserted = `${changed.insertedLine}`;
  const replacement = `${head}\n${commented}\n${inserted}\n${tail}`;
  workingLines[idx] = replacement;
  return { ok: true, newLines: workingLines, hunk: { line: lineNumber || 1, original, inserted, rule: finding.rule, reason: changed.reason } };
}

async function cloneRepoAtSha(repo, sha) {
  const tempDir = path.join(os.tmpdir(), `peer-autofix-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fsp.mkdir(tempDir, { recursive: true });
  const url = safeRepoUrl(repo);
  const git = simpleGit();
  try {
    // Shallow, no-checkout clone then fetch only the target commit
    await git.clone(url, tempDir, ['--no-checkout']);
    const git2 = simpleGit({ baseDir: tempDir });
    await git2.fetch('origin', sha, { '--depth': 1 });
    await git2.checkout(sha);
    return { tempDir, git: git2 };
  } catch (e) {
    // Fallback to full clone + checkout
    const git3 = simpleGit();
    await git3.clone(url, tempDir);
    const git4 = simpleGit({ baseDir: tempDir });
    await git4.checkout(sha);
    return { tempDir, git: git4 };
  }
}

async function buildPreview(patchRequestId) {
  const patch = await PatchRequest.findById(patchRequestId);
  if (!patch) throw new Error('PatchRequest not found');
  const prRun = await PRRun.findById(patch.runId);
  if (!prRun) throw new Error('Run not found');
  
  // Load user context for API keys and token tracking
  const User = require('../models/User');
  const userContext = patch.userId ? await User.findById(patch.userId) : null;
  
  // Check token limit before starting (estimate ~2000 tokens per file)
  if (userContext) {
    const { checkUserTokenLimit } = require('../utils/userTokens');
    const { notifyTokenLimitExceeded } = require('../utils/errorNotification');
    const estimatedTokens = 2000; // Conservative estimate
    const check = await checkUserTokenLimit(userContext, estimatedTokens);
    if (!check.allowed && !check.useUserKeys) {
      patch.status = 'failed';
      patch.error = check.reason;
      await patch.save();
      logger.error('autofix', 'Token limit exceeded', { 
        patchRequestId, 
        userId: userContext._id,
        reason: check.reason 
      });
      
      // Notify user about token limit
      await notifyTokenLimitExceeded(
        userContext._id,
        userContext.tokensUsed || 0,
        userContext.tokenLimit || 1000
      );
      
      throw new Error(check.reason);
    }
    logger.info('autofix', 'User context loaded', { 
      patchRequestId, 
      userId: userContext._id,
      hasGroqKey: !!userContext.apiKeys?.groq,
      hasGeminiKey: !!userContext.apiKeys?.gemini,
      tokenLimit: userContext.tokenLimit,
      tokensUsed: userContext.tokensUsed
    });
  }

  const startTs = Date.now();
  const timeBudgetMs = parseInt(process.env.PREVIEW_TIME_BUDGET_MS || '30000', 10) || 30000;
  const initialMaxFiles = parseInt(process.env.PREVIEW_INITIAL_MAX_FILES || '30', 10) || 30;

  // Prepare patch for progressive updates
  patch.status = 'preview_partial';
  patch.preview = { unifiedDiff: '', files: [], filesExpected: 0 };
  await patch.save();

  const { tempDir } = await cloneRepoAtSha(patch.repo, patch.sha);
  let selected = prRun.findings.filter(f => patch.selectedFindingIds.includes(String(f._id)));

  // Severity prioritization
  const sevOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  selected = selected.slice().sort((a,b)=> (sevOrder[b.severity||'low']-sevOrder[a.severity||'low']) || a.file.localeCompare(b.file) || ((a.line||0)-(b.line||0)));

  // Limit to unique files list for planning
  const filesPlanned = Array.from(new Set(selected.map(f=>f.file)));
  patch.preview.filesExpected = filesPlanned.length;
  await patch.save();

  const fileMap = new Map(); // file -> { originalLines, newLines, hunks: [], eol }
  for (const f of selected) {
    const abs = path.join(tempDir, f.file);
    let content;
    try { content = await fsp.readFile(abs, 'utf8'); } catch { continue; }
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    if (!fileMap.has(f.file)) fileMap.set(f.file, { originalLines: content.split(/\r?\n/), newLines: null, hunks: [], findingIds: new Set(), eol });
    const entry = fileMap.get(f.file);
    entry.findingIds.add(String(f._id));
    const baseLines = entry.newLines || entry.originalLines;
    const result = applyLineTransform(f.file, baseLines, f.line, f);
    if (!result.ok) {
      entry.hunks.push({ line: f.line, original: baseLines[f.line - 1] || '', inserted: '', rule: f.rule, findingId: String(f._id), failed: true, reason: result.reason });
      entry.newLines = baseLines; // unchanged so far
      continue;
    }
    entry.newLines = result.newLines;
    entry.hunks.push({ ...result.hunk, rule: f.rule, findingId: String(f._id) });
  }

  const strategy = (process.env.LLM_STRATEGY || ((process.env.LLM_PROVIDER||'').toLowerCase()==='gemini' ? 'minimal' : 'full')).toLowerCase(); // 'minimal' | 'full'
  logger.info('autofix', 'Strategy selected for batch preview', {
    strategy,
    LLM_STRATEGY: process.env.LLM_STRATEGY,
    LLM_PROVIDER: process.env.LLM_PROVIDER
  });
  // Attempt AI assistance per file
  const rewriteMode = process.env.LLM_REWRITE_MODE || 'always'; // 'always' | 'auto' | 'unchanged_only'
  for (const [file, entry] of fileMap.entries()) {
    const originalText = entry.originalLines.join('\n');
    const currentText = (entry.newLines || entry.originalLines).join('\n');
    const hasFailures = (entry.hunks || []).some(h => h.failed);
    const unchanged = currentText === originalText;
    const canUseAI = !!(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
    const shouldCall = canUseAI && (
      rewriteMode === 'always' ||
      (rewriteMode === 'auto' && (unchanged || hasFailures)) ||
      (rewriteMode === 'unchanged_only' && unchanged)
    );
    if (!shouldCall) continue;

    try {
      const relatedFindings = selected.filter(x => x.file === file);
      if (strategy === 'minimal') {
        // Ask AI for minimal patches and apply them as line replacements with canonical FIX/OLD/WARN tokens
        const plan = await planMinimalFixesWithAI({ file, code: currentText, findings: relatedFindings });
        const patches = Array.isArray(plan?.patches) ? plan.patches : [];
        if (patches.length) {
          let lines = (entry.newLines || entry.originalLines).slice();
          const maxPatches = parseInt(process.env.LLM_MAX_PATCHES_PER_FILE || '5', 10) || 5;
          let appliedCount = 0;

          function tokensFor(filePath) {
            const ext = (require('path').extname(filePath) || '').toLowerCase();
            // Mapping per user spec
            if (/\.(sql)$/i.test(ext)) return { fix: '-- FIX:', old: '-- OLD:', warn: '-- WARN:' };
            if (/\.(html?|xml)$/i.test(ext)) return { fix: '<!-- FIX:', old: '<!-- OLD:', warn: '<!-- WARN:', close: ' -->' };
            if (/\.(css)$/i.test(ext)) return { fix: '/* FIX:', old: '/* OLD:', warn: '/* WARN:', close: ' */' };
            // Default and for js/ts/jsx/json/dockerfile/yaml and Java/C/C++/Go/Rust
            return { fix: '// FIX:', old: '// OLD:', warn: '// WARN:' };
          }
          const tok = tokensFor(file);

          function lineWithComment(codeLine, label, text) {
            if (tok.close) return `${codeLine} ${tok[label]} ${text}${tok.close}`;
            return `${codeLine} ${tok[label]} ${text}`;
          }

          for (const p of patches) {
            if (appliedCount >= maxPatches) break;
            const idx = (p.line || 1) - 1;
            if (idx < 0 || idx >= lines.length) continue;
            const original = lines[idx] ?? '';
            const fix = String(p.newCode || '');
            // Simple multi-line guard: only allow when explicitly flagged and env allows
            const isMultiLine = /\n/.test(fix) || p.multiLine === true;
            const allowMulti = (String(process.env.LLM_MULTILINE_ALLOWED || '0') === '1') || (p.type === 'multi-line-allowed');
            if (isMultiLine && !allowMulti) continue;
            const reason = String(p.reason || '').trim().slice(0, 120) || 'minimal fix';
            const warn = (p.warn && String(p.warn).trim()) ? String(p.warn).trim().slice(0, 160) : '';

            // Replace target line with fixed code and FIX reason
            lines[idx] = lineWithComment(fix, 'fix', reason);
            // Insert OLD line immediately after (verbatim)
            lines.splice(idx + 1, 0, lineWithComment('', 'old', original));
            if (warn) lines.splice(idx + 2, 0, lineWithComment('', 'warn', warn));

            // Track a hunk for UI (inserted == fix)
            const findingId = String(p.findingId || relatedFindings[0]?._id || 'ai');
            const originalChecksum = crypto.createHash('sha1').update(original, 'utf8').digest('hex');
            (entry.hunks = entry.hunks || []).push({ line: p.line, original, inserted: fix, rule: relatedFindings.find(f=>String(f._id)===findingId)?.rule || 'ai-minimal', findingId, originalChecksum, warn, provider: plan.provider || (process.env.LLM_PROVIDER||'auto'), model: plan.model || '', timestamp: new Date(plan.timestamp || Date.now()), type: String(p.type||'').toLowerCase(), multiLine: !!isMultiLine });
            appliedCount++;
          }
          entry.newLines = lines;
          // Keep aiRewritten = false for minimal patches; we will apply with verification
          entry.aiRewritten = false;
          // Build change summary for this file
          entry.changeSummary = {
            file,
            patches: (entry.hunks || []).map(h => ({ findingId: h.findingId, line: h.line, type: h.type || 'syntax', reason: plan.patches.find(p=>String(p.findingId||'ai')===String(h.findingId))?.reason || '', warn: h.warn || '' })),
            model: plan.model || '',
            provider: plan.provider || (process.env.LLM_PROVIDER||'auto'),
            timestamp: new Date(plan.timestamp || Date.now()),
          };
          continue;
        }
        // If no patches returned, leave as-is
      } else {
        // Full-file rewrite
        const improved = await rewriteFileWithAI({ 
          file, 
          code: currentText, 
          findings: relatedFindings,
          userContext // Pass user context for API keys and token tracking
        });
        if (improved && improved.text && typeof improved.text === 'string') {
          const normalized = String(improved.text).replace(/\r\n/g, '\n');
          if (normalized.trim() && normalized.trim() !== currentText.trim()) {
            entry.newLines = normalized.split('\n');
            entry.aiRewritten = true;
            logger.info('autofix', 'AI rewrite applied', { file, provider: improved.provider, cached: !!improved.cached });
          } else {
            logger.info('autofix', 'AI returned unchanged content', { file });
          }
        }
      }
    } catch (e) {
      logger.warn('autofix', 'AI assist failed', { file, reason: String(e?.message || e) });
    }
  }

  // Build unified diff per file (progressive save)
  const previews = [];
  let unifiedDiff = '';
  let processedCount = 0;
  let savedAtCount = 0;
  for (const [file, ctx] of fileMap.entries()) {
    const { originalLines, newLines, hunks, findingIds, aiRewritten, eol, changeSummary } = ctx;
    const improvedLines = newLines || originalLines;

    // For JS/TS: syntax check before including (use improvedLines)
    const ext = path.extname(file).toLowerCase();
    let syntaxOk = true;
    if (/\.(js|jsx|ts|tsx)$/.test(ext)) {
      try {
        const tmpOut = path.join(tempDir, `.__preview_${path.basename(file).replace(/[^a-zA-Z0-9_.-]/g,'_')}`);
        await fsp.writeFile(tmpOut, improvedLines.join('\n'), 'utf8');
        await new Promise((resolve) => {
          const { spawn } = require('child_process');
          const nodeCmd = process.platform === 'win32' ? 'node.exe' : 'node';
          const cp = spawn(nodeCmd, ['--check', tmpOut], { stdio: ['ignore', 'ignore', 'ignore'] });
          cp.on('close', (code) => resolve(code));
        }).then((code) => { if (code !== 0) syntaxOk = false; });
      } catch { syntaxOk = false; }
    }

    const changed = improvedLines.join('\n') !== originalLines.join('\n');

    // Build per-file unified diff (if changed and syntax OK)
    let fileUnified = '';
    if (changed && syntaxOk) {
      const diff = toUnifiedDiff(file, originalLines, improvedLines);
      fileUnified = diff;
      unifiedDiff += diff + '\n';
    }

    const hWithContext = (hunks || []).map(h => ({
      ...h,
      originalContext: (originalLines[h.line - 1] || ''),
      insertedContext: h.inserted || '',
    }));

    const filePreview = {
      file,
      ok: syntaxOk && changed,
      hunks: syntaxOk ? hWithContext : (hWithContext.map(h => ({ ...h, failed: true, reason: h.reason || 'syntax_check_failed' }))),
      originalText: originalLines.join('\n'),
      improvedText: improvedLines.join('\n'),
      unifiedDiff: fileUnified,
      findingIds: Array.from(findingIds || []),
      aiRewritten: !!aiRewritten,
      eol: eol || '\n',
      changeSummary: changeSummary || undefined,
    };
    previews.push(filePreview);
    // Progressive append and save periodically or on time budget/initial cap
    patch.preview.files.push(filePreview);
    patch.preview.unifiedDiff = unifiedDiff;
    processedCount++;

    const overInitial = processedCount >= initialMaxFiles;
    const overBudget = (Date.now() - startTs) >= timeBudgetMs;
    const saveInterval = (processedCount - savedAtCount) >= 5;
    if (overInitial || overBudget || saveInterval) {
      patch.status = (overInitial || overBudget) ? 'preview_partial' : patch.status;
      await patch.save();
      savedAtCount = processedCount;
    }
  }

  // Final save
  patch.status = 'preview_ready';
  patch.preview.unifiedDiff = unifiedDiff;
  // Ensure full list present
  patch.preview.files = previews;
  await patch.save();
  return patch;
}

async function applyPatch(patchRequestId) {
  const patch = await PatchRequest.findById(patchRequestId);
  if (!patch) throw new Error('PatchRequest not found');
  const prRun = await PRRun.findById(patch.runId);
  if (!prRun) throw new Error('Run not found');

  patch.status = 'applying';
  await patch.save();

  const { tempDir, git } = await cloneRepoAtSha(patch.repo, patch.sha);
  const branchName = `peer/autofix/${patch.runId}-${Date.now()}`;
  await git.checkoutLocalBranch(branchName);

  const applied = [];
  const skipped = [];
  const errors = [];

  // Re-apply preview hunks to fresh clone
  for (const f of patch.preview.files || []) {
    const file = f.file;
    const abs = path.join(tempDir, file);
    const eol = f.eol || '\n';
    
    // Debug logging
    logger.info('autofix', 'Applying file', {
      file,
      aiRewritten: f.aiRewritten,
      hasImprovedText: !!(f.improvedText && f.improvedText.trim()),
      hunksCount: (f.hunks || []).length
    });
    
    // If AI provided a full-file improvedText, write it as-is
    if (f.aiRewritten && typeof f.improvedText === 'string' && f.improvedText.trim()) {
      try {
        await fsp.mkdir(path.dirname(abs), { recursive: true });
      } catch {}
      await fsp.writeFile(abs, String(f.improvedText).replace(/\r\n/g, '\n').split('\n').join(eol), 'utf8');
      const ids = Array.isArray(f.findingIds) && f.findingIds.length ? f.findingIds : ['all'];
      ids.forEach(id => applied.push({ findingId: id, file }));
      continue;
    }

    // Minimal patches with verification
    let content;
    try { content = await fsp.readFile(abs, 'utf8'); } catch (e) { skipped.push({ findingId: 'all', file, reason: 'file_read_error' }); continue; }
    let lines = content.split(/\r?\n/);

    function tokensFor(filePath) {
      const ext = (path.extname(filePath) || '').toLowerCase();
      if (/\.(sql)$/i.test(ext)) return { fix: '-- FIX:', old: '-- OLD:', warn: '-- WARN:' };
      if (/\.(html?|xml)$/i.test(ext)) return { fix: '<!-- FIX:', old: '<!-- OLD:', warn: '<!-- WARN:', close: ' -->' };
      if (/\.(css)$/i.test(ext)) return { fix: '/* FIX:', old: '/* OLD:', warn: '/* WARN:', close: ' */' };
      if (/\.(py|rb|toml|ini|env)$/i.test(ext)) return { fix: '# FIX:', old: '# OLD:', warn: '# WARN:' };
      if (/\.(md)$/i.test(ext)) return { fix: '<!-- FIX:', old: '<!-- OLD:', warn: '<!-- WARN:', close: ' -->' };
      return { fix: '// FIX:', old: '// OLD:', warn: '// WARN:' };
    }
    const tok = tokensFor(file);
    const maxPatches = parseInt(process.env.LLM_MAX_PATCHES_PER_FILE || '5', 10) || 5;
    let count = 0;

    for (const h of (f.hunks || [])) {
      if (h.failed) { skipped.push({ findingId: h.findingId, file, reason: h.reason || 'failed_in_preview' }); continue; }
      if (count >= maxPatches) { skipped.push({ findingId: h.findingId, file, reason: 'max_patches_reached' }); continue; }
      const idx = (h.line || 1) - 1;
      if (idx < 0 || idx >= lines.length) { skipped.push({ findingId: h.findingId, file, reason: 'line_out_of_range' }); continue; }
      const current = lines[idx] ?? '';
      const checksum = crypto.createHash('sha1').update(current, 'utf8').digest('hex');
      if (h.originalChecksum && checksum !== h.originalChecksum) {
        skipped.push({ findingId: h.findingId, file, reason: 'checksum_mismatch' });
        continue;
      }
      const fixLine = String(h.inserted || '');
      const reason = (h.reason || 'minimal fix');
      function lineWithComment(codeLine, label, text) {
        if (tok.close) return `${codeLine} ${tok[label]} ${text}${tok.close}`;
        return `${codeLine} ${tok[label]} ${text}`;
      }
      // Write fixed line + OLD + optional WARN
      lines[idx] = lineWithComment(fixLine, 'fix', reason);
      lines.splice(idx + 1, 0, lineWithComment('', 'old', current));
      if (h.warn) lines.splice(idx + 2, 0, lineWithComment('', 'warn', h.warn));
      applied.push({ findingId: h.findingId, file });
      count++;
    }

    await fsp.writeFile(abs, lines.join(eol), 'utf8');
  }

  // Commit and push
  try {
    await git.add('.');
    await git.commit(`peer: autofix ${applied.length} change(s) for run ${patch.runId}`);
    // Attempt push
    await git.push('origin', branchName, { '--set-upstream': null });
  } catch (e) {
    errors.push({ message: 'git_push_error', stack: String(e) });
  }

  let commitSha = '';
  try { const log = await git.log({ maxCount: 1 }); commitSha = log.latest && log.latest.hash; } catch {}

  patch.results = { branchName, commitSha, applied, skipped, errors };
  patch.status = errors.length ? 'failed' : 'completed';
  await patch.save();

  // Mark selected findings as fixed on success
  if (!errors.length) {
    try {
      const run = await PRRun.findById(patch.runId);
      if (run) {
        const idSet = new Set((patch.selectedFindingIds || []).map(String));
        let fixedCount = 0;
        (run.findings || []).forEach(f => {
          if (idSet.has(String(f._id))) {
            f.fixed = true;
            f.fixedAt = new Date();
            f.fixedByPatchRequestId = String(patch._id);
            fixedCount++;
          }
        });
        await run.save();
        
        logger.info('autofix', '✅ FINDINGS MARKED AS FIXED', {
          runId: patch.runId,
          patchRequestId: String(patch._id),
          fixedCount,
          totalFindings: run.findings.length,
          repo: run.repo,
          prNumber: run.prNumber
        });
        
        // Calculate stats
        const totalIssues = run.findings.length;
        const totalFixed = run.findings.filter(f => f.fixed).length;
        const fixRate = totalIssues > 0 ? Math.round((totalFixed / totalIssues) * 100) : 0;
        
        console.log('\n========================================');
        console.log('🎉 AUTO-FIX COMPLETED');
        console.log('========================================');
        console.log(`📦 Repository: ${run.repo}`);
        console.log(`🔢 PR Number: #${run.prNumber}`);
        console.log(`🔍 Total Issues: ${totalIssues}`);
        console.log(`✅ Fixed in this run: ${fixedCount}`);
        console.log(`💯 Total Fixed: ${totalFixed} (${fixRate}%)`);
        console.log('========================================\n');
      }
    } catch (e) {
      logger.warn('autofix', 'Failed to mark findings fixed', { runId: patch.runId, error: String(e) });
    }
  }

  // Create Pull Request and attempt auto-merge if in commit/merge mode
  if (!errors.length) {
    try {
      const { createPullRequest, attemptAutoMerge } = require('../services/githubPR');
      const Installation = require('../models/Installation');
      
      // Get installation config
      const run = await PRRun.findById(patch.runId);
      if (run && run.installationId) {
        const installation = await Installation.findById(run.installationId);
        
        if (installation && (installation.config.mode === 'commit' || installation.config.mode === 'merge')) {
          // Parse repo owner/name
          const [owner, repo] = patch.repo.split('/');
          
          // Detect base branch from repository default
          const { getInstallationOctokit } = require('../services/githubApp');
          let baseBranch = 'main'; // default fallback
          try {
            const octokit = await getInstallationOctokit(installation.installationId);
            const { data: repoData } = await octokit.repos.get({ owner, repo });
            baseBranch = repoData.default_branch || 'main';
            logger.info('autofix', 'Detected default branch', { repo: patch.repo, baseBranch });
          } catch (branchError) {
            logger.warn('autofix', 'Failed to detect default branch, using main', { 
              repo: patch.repo, 
              error: String(branchError) 
            });
          }
          
          // Create PR with fixes
          logger.info('autofix', 'Creating pull request for fixes', {
            patchRequestId: patch._id.toString(),
            branch: branchName,
            base: baseBranch
          });
          
          const prResult = await createPullRequest({
            owner,
            repo,
            head: branchName,
            base: baseBranch,
            title: `peer: Auto-fix ${applied.length} issue(s) from PR #${patch.prNumber}`,
            body: `This PR contains automatic fixes for issues found in PR #${patch.prNumber}.\n\n**Fixed:**\n- ${applied.length} issue(s) across ${new Set(applied.map(a => a.file)).size} file(s)\n\n**Skipped:**\n- ${skipped.length} issue(s)\n\nGenerated by Peer AI Code Review.`
          });
          
          patch.results.fixPrNumber = prResult.prNumber;
          patch.results.fixPrUrl = prResult.url;
          await patch.save();
          
          logger.info('autofix', 'Pull request created successfully', {
            patchRequestId: patch._id.toString(),
            prNumber: prResult.prNumber,
            url: prResult.url
          });
          
          // Attempt auto-merge if mode is 'merge'
          if (installation.config.mode === 'merge') {
            logger.info('autofix', 'Attempting auto-merge', {
              patchRequestId: patch._id.toString(),
              prNumber: prResult.prNumber
            });
            
            const mergeResult = await attemptAutoMerge({
              owner,
              repo,
              prNumber: prResult.prNumber,
              ref: commitSha,
              config: installation.config
            });
            
            patch.results.autoMerged = mergeResult.merged;
            patch.results.autoMergeReason = mergeResult.reason;
            await patch.save();
            
            if (mergeResult.merged) {
              logger.info('autofix', 'Pull request auto-merged successfully', {
                patchRequestId: patch._id.toString(),
                prNumber: prResult.prNumber
              });
            } else {
              logger.info('autofix', 'Pull request not auto-merged', {
                patchRequestId: patch._id.toString(),
                prNumber: prResult.prNumber,
                reason: mergeResult.reason
              });
            }
          }
        }
      }
    } catch (prError) {
      logger.error('autofix', 'Failed to create/merge pull request', {
        patchRequestId: patch._id.toString(),
        error: String(prError),
        stack: prError.stack
      });
      // Don't fail the whole patch - it was still applied successfully
    }
  }

  return patch;
}

async function buildPreviewForSingleFile(patchRequestId, filePath) {
  const patch = await PatchRequest.findById(patchRequestId);
  if (!patch) throw new Error('PatchRequest not found');
  const prRun = await PRRun.findById(patch.runId);
  if (!prRun) throw new Error('Run not found');
  
  // Load user context for API keys and token tracking
  const User = require('../models/User');
  const userContext = patch.userId ? await User.findById(patch.userId) : null;

  // Skip non-code files that shouldn't be auto-fixed
  const nonCodeFiles = [
    /^LICENSE$/i,
    /^README(\.md)?$/i,
    /^CHANGELOG(\.md)?$/i,
    /^CONTRIBUTING(\.md)?$/i,
    /^\.gitignore$/i,
    /^\.dockerignore$/i,
    /^package-lock\.json$/i,
    /^yarn\.lock$/i,
    /^pnpm-lock\.yaml$/i,
    /^\.env(\.example)?$/i,
    /\.(txt|md|rst|log|lock)$/i,
  ];
  
  const fileBasename = path.basename(filePath);
  const shouldSkip = nonCodeFiles.some(pattern => pattern.test(fileBasename));
  
  if (shouldSkip) {
    logger.info('autofix', 'Skipping non-code file', { file: filePath });
    patch.preview = patch.preview || { unifiedDiff: '', files: [], filesExpected: 0 };
    let stubIndex = (patch.preview.files || []).findIndex(f => f.file === filePath);
    if (stubIndex === -1) {
      patch.preview.files.push({ file: filePath, ready: true, skipped: true, skipReason: 'non-code-file', findingIds: [] });
      stubIndex = patch.preview.files.length - 1;
    } else {
      patch.preview.files[stubIndex].ready = true;
      patch.preview.files[stubIndex].skipped = true;
      patch.preview.files[stubIndex].skipReason = 'non-code-file';
    }
    // Update patch status if all ready
    const planned = patch.preview.filesExpected || patch.preview.files.length;
    const readyCount = (patch.preview.files || []).filter(f => f.ready).length;
    patch.status = (readyCount >= planned && planned > 0) ? 'preview_ready' : 'preview_partial';
    await patch.save();
    return patch;
  }

  const findings = (prRun.findings || []).filter(f => patch.selectedFindingIds.includes(String(f._id)) && f.file === filePath);
  // Ensure preview object exists and file stub exists
  patch.preview = patch.preview || { unifiedDiff: '', files: [], filesExpected: 0 };
  let stubIndex = (patch.preview.files || []).findIndex(f => f.file === filePath);
  if (stubIndex === -1) {
    patch.preview.files.push({ file: filePath, ready: false, findingIds: findings.map(f=>String(f._id)) });
    stubIndex = patch.preview.files.length - 1;
  }
  await patch.save();

  if (!findings.length) {
    // Mark as ready with no changes
    patch.preview.files[stubIndex].ready = true;
    patch.preview.files[stubIndex].hunks = [];
    patch.preview.files[stubIndex].originalText = '';
    patch.preview.files[stubIndex].improvedText = '';
    patch.preview.files[stubIndex].unifiedDiff = '';
    // Update patch status if all ready
    const planned = patch.preview.filesExpected || patch.preview.files.length;
    const readyCount = (patch.preview.files || []).filter(f => f.ready).length;
    patch.status = (readyCount >= planned && planned > 0) ? 'preview_ready' : 'preview_partial';
    await patch.save();
    return patch;
  }

  // Clone repo shallow
  const { tempDir } = await cloneRepoAtSha(patch.repo, patch.sha);
  const abs = path.join(tempDir, filePath);
  let content = '';
  try { content = await fsp.readFile(abs, 'utf8'); } catch (e) {
    patch.preview.files[stubIndex].ready = false;
    patch.preview.files[stubIndex].error = 'file_read_error';
    await patch.save();
    return patch;
  }
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const originalLines = content.split(/\r?\n/);

  // Apply minimal strategy on this file
  let hunks = [];
  let newLines = null;
  const currentText = originalLines.join('\n');
  const strategy = (process.env.LLM_STRATEGY || ((process.env.LLM_PROVIDER||'').toLowerCase()==='gemini' ? 'minimal' : 'full')).toLowerCase();
  logger.info('autofix', 'Strategy detected', { 
    strategy, 
    file: filePath,
    LLM_STRATEGY: process.env.LLM_STRATEGY,
    LLM_PROVIDER: process.env.LLM_PROVIDER
  });
  if (strategy === 'minimal') {
    try {
      const plan = await planMinimalFixesWithAI({ file: filePath, code: currentText, findings });
      const patches = Array.isArray(plan?.patches) ? plan.patches : [];
      if (patches.length) {
        let lines = originalLines.slice();
        function tokensFor(filePath) {
          const ext = (path.extname(filePath) || '').toLowerCase();
          if (/\.(sql)$/i.test(ext)) return { fix: '-- FIX:', old: '-- OLD:', warn: '-- WARN:' };
          if (/\.(html?|xml)$/i.test(ext)) return { fix: '<!-- FIX:', old: '<!-- OLD:', warn: '<!-- WARN:', close: ' -->' };
          if (/\.(css)$/i.test(ext)) return { fix: '/* FIX:', old: '/* OLD:', warn: '/* WARN:', close: ' */' };
          if (/\.(py|rb|toml|ini|env)$/i.test(ext)) return { fix: '# FIX:', old: '# OLD:', warn: '# WARN:' };
          if (/\.(md)$/i.test(ext)) return { fix: '<!-- FIX:', old: '<!-- OLD:', warn: '<!-- WARN:', close: ' -->' };
          return { fix: '// FIX:', old: '// OLD:', warn: '// WARN:' };
        }
        const tok = tokensFor(filePath);
        function lineWithComment(codeLine, label, text) {
          if (tok.close) return `${codeLine} ${tok[label]} ${text}${tok.close}`;
          return `${codeLine} ${tok[label]} ${text}`;
        }
        const maxPatches = parseInt(process.env.LLM_MAX_PATCHES_PER_FILE || '5', 10) || 5;
        let count = 0;
        for (const p of patches) {
          if (count >= maxPatches) break;
          const idx = (p.line || 1) - 1;
          if (idx < 0 || idx >= lines.length) continue;
          const original = lines[idx] ?? '';
          const fix = String(p.newCode || '');
          const isMultiLine = /\n/.test(fix) || p.multiLine === true;
          const allowMulti = (String(process.env.LLM_MULTILINE_ALLOWED || '0') === '1') || (p.type === 'multi-line-allowed');
          if (isMultiLine && !allowMulti) continue;
          const reason = String(p.reason || '').trim().slice(0, 120) || 'minimal fix';
          const warn = (p.warn && String(p.warn).trim()) ? String(p.warn).trim().slice(0, 160) : '';
          const findingId = String(p.findingId || findings[0]?._id || 'ai');
          lines[idx] = lineWithComment(fix, 'fix', reason);
          lines.splice(idx + 1, 0, lineWithComment('', 'old', original));
          if (warn) lines.splice(idx + 2, 0, lineWithComment('', 'warn', warn));
          const originalChecksum = crypto.createHash('sha1').update(original, 'utf8').digest('hex');
          hunks.push({ line: p.line, original, inserted: fix, rule: findings.find(f=>String(f._id)===findingId)?.rule || 'ai-minimal', findingId, originalChecksum, warn, provider: plan.provider || (process.env.LLM_PROVIDER||'auto'), model: plan.model || '', timestamp: new Date(plan.timestamp || Date.now()), type: String(p.type||'').toLowerCase(), multiLine: !!isMultiLine });
          count++;
        }
        newLines = lines;
      }
    } catch (e) {
      // ignore
    }
  } else {
    const out = await rewriteFileWithAI({ 
      file: filePath, 
      code: currentText, 
      findings,
      userContext // Pass user context for API keys and token tracking
    });
    const text = out?.text || '';
    if (text && text.trim() && text.trim() !== currentText.trim()) {
      newLines = String(text).replace(/\r\n/g, '\n').split('\n');
    }
  }

  const improvedLines = newLines || originalLines;
  const fileUnified = toUnifiedDiff(filePath, originalLines, improvedLines);

  // Build change summary from hunks
  let changeSummary = null;
  if (hunks && hunks.length > 0) {
    changeSummary = {
      file: filePath,
      patches: hunks.map(h => ({
        findingId: h.findingId,
        line: h.line,
        type: h.type || 'syntax',
        reason: h.inserted ? `Changed to: ${String(h.inserted).slice(0, 60)}...` : 'Applied fix',
        warn: h.warn || ''
      })),
      model: hunks[0]?.model || '',
      provider: hunks[0]?.provider || (process.env.LLM_PROVIDER||'auto'),
      timestamp: new Date()
    };
  }
  
  // Update file entry
  patch.preview.files[stubIndex].ready = true;
  patch.preview.files[stubIndex].hunks = hunks;
  const origText = originalLines.join('\n');
  const improvedText = improvedLines.join('\n');
  patch.preview.files[stubIndex].originalText = origText;
  patch.preview.files[stubIndex].improvedText = improvedText;
  patch.preview.files[stubIndex].unifiedDiff = fileUnified;
  patch.preview.files[stubIndex].findingIds = findings.map(f=>String(f._id));
  // Set aiRewritten=true if text changed and we have no hunks, OR if text changed significantly
  const textChanged = origText !== improvedText;
  patch.preview.files[stubIndex].aiRewritten = textChanged && (hunks.length === 0 || strategy === 'full');
  patch.preview.files[stubIndex].eol = eol;
  patch.preview.files[stubIndex].changeSummary = changeSummary;

  // Update patch status if all ready
  const planned = patch.preview.filesExpected || patch.preview.files.length;
  const readyCount = (patch.preview.files || []).filter(f => f.ready).length;
  const newStatus = (readyCount >= planned && planned > 0) ? 'preview_ready' : 'preview_partial';
  logger.info('autofix', 'Updating patch status', { 
    patchRequestId: patch._id.toString(),
    file: filePath,
    readyCount, 
    planned, 
    oldStatus: patch.status,
    newStatus 
  });
  patch.status = newStatus;
  await patch.save();
  return patch;
}

module.exports = { buildPreview, applyPatch, buildPreviewForSingleFile };
