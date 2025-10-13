require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { analyzeQueue, autofixQueue } = require('../../shared/queue');
const PRRun = require('../../shared/models/PRRun');
const logger = require('../../shared/utils/prettyLogger');
const llmCache = require('../../shared/cache/llmCache');

const app = express();
app.use(express.json({ limit: '2mb' }));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/peer')
  .then(() => logger.info('api', 'Connected to MongoDB'))
  .catch((err) => {
    logger.error('api', 'MongoDB connection error', { error: String(err) });
    process.exit(1);
  });

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Cache statistics endpoint
app.get('/api/cache/stats', async (req, res) => {
  try {
    const stats = await llmCache.getStats();
    res.json({
      ok: true,
      cache: stats,
      enabled: process.env.REDIS_CACHE_ENABLED !== 'false',
      ttl: parseInt(process.env.REDIS_CACHE_TTL || '86400', 10)
    });
  } catch (error) {
    logger.error('api', 'Cache stats error', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch cache stats' });
  }
});

// Clear cache endpoint
app.delete('/api/cache/clear', async (req, res) => {
  try {
    await llmCache.clear();
    res.json({ ok: true, message: 'Cache cleared successfully' });
  } catch (error) {
    logger.error('api', 'Cache clear error', { error: String(error) });
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Reset cache stats endpoint
app.post('/api/cache/reset-stats', async (req, res) => {
  try {
    await llmCache.resetStats();
    res.json({ ok: true, message: 'Cache stats reset successfully' });
  } catch (error) {
    logger.error('api', 'Cache reset stats error', { error: String(error) });
    res.status(500).json({ error: 'Failed to reset cache stats' });
  }
});

function mapPayload(req) {
  // Support GitHub webhook payloads and manual JSON from Postman
  const ghEvent = req.header('X-GitHub-Event');
  const delivery = req.header('X-GitHub-Delivery');

  if (req.body && req.body.pull_request && req.body.repository) {
    const repo = req.body.repository.full_name;
    const prNumber = req.body.pull_request.number;
    const sha = req.body.pull_request.head && req.body.pull_request.head.sha;
    const baseSha = req.body.pull_request.base && req.body.pull_request.base.sha;
    return { repo, prNumber, sha, baseSha, source: 'github', ghEvent, delivery };
  }

  const { repo, prNumber, sha, baseSha } = req.body || {};
  return { repo, prNumber, sha, baseSha, source: 'manual', ghEvent, delivery };
}

// Get PR analysis results (exclude fixed findings by default)
app.get('/runs/:runId', async (req, res) => {
  try {
    const prRun = await PRRun.findById(req.params.runId);
    if (!prRun) {
      return res.status(404).json({ error: 'Run not found' });
    }
    const showAll = String(req.query.show || '').toLowerCase() === 'all';
    const findings = showAll ? prRun.findings : (prRun.findings || []).filter(f => !f.fixed);
    // Compute active summary by severity
    const summary = { low: 0, medium: 0, high: 0, critical: 0 };
    findings.forEach(f => { if (summary[f.severity] !== undefined) summary[f.severity]++; });
    const out = {
      _id: prRun._id,
      repo: prRun.repo,
      prNumber: prRun.prNumber,
      sha: prRun.sha,
      status: prRun.status,
      createdAt: prRun.createdAt,
      updatedAt: prRun.updatedAt,
      findings,
      summary,
    };
    res.json(out);
  } catch (error) {
    logger.error('api', 'Error fetching run', { runId: req.params.runId, error: String(error) });
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

// Get PR analysis results by repo and PR number
app.get('/runs/repo/:owner/:name/pr/:prNumber', async (req, res) => {
  try {
    const repo = `${req.params.owner}/${req.params.name}`;
    const prNumber = parseInt(req.params.prNumber);

    const runs = await PRRun.find({ repo, prNumber }).sort({ createdAt: -1 }).limit(10);
    if (!runs.length) {
      return res.status(404).json({ error: 'No runs found for this PR' });
    }

    res.json({ runs, latest: runs[0] });
  } catch (error) {
    logger.error('api', 'Error fetching runs', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

// GitHub webhook endpoint
app.post('/webhook/github', async (req, res) => {
  const { repo, prNumber, sha, baseSha, source, ghEvent, delivery } = mapPayload(req);
  try {
    // Validate required fields
    if (!repo || !prNumber || !sha) {
      return res.status(400).json({ error: 'Missing required fields: repo, prNumber, sha' });
    }

    logger.info('api', 'Webhook received', { source, ghEvent, delivery, repo, prNumber, sha });

    // Create a new PRRun with queued status
    const prRun = new PRRun({ repo, prNumber, sha, status: 'queued' });

    try {
      await prRun.save(); // Save to DB
      logger.info('api', 'PRRun saved to DB', { runId: prRun._id.toString(), repo, prNumber, sha });

      // Verify it was actually saved by reading it back
      const verified = await PRRun.findById(prRun._id);
      if (verified) {
        logger.info('api', 'PRRun verified in DB', { runId: prRun._id.toString() });
      } else {
        logger.error('api', 'PRRun NOT found after save!', { runId: prRun._id.toString() });
        throw new Error('PRRun verification failed');
      }
    } catch (saveError) {
      logger.error('api', 'Failed to save PRRun', { error: String(saveError), stack: saveError.stack });
      throw saveError;
    }

    logger.info('api', 'PRRun created', { runId: prRun._id.toString(), repo, prNumber, sha });

    // Small delay to ensure DB replication (if any)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Enqueue the analysis job
    const job = await analyzeQueue.add('analyze', {
      runId: prRun._id.toString(),
      repo,
      prNumber,
      sha,
      baseSha,
    });

    logger.info('api', 'Job enqueued', { jobId: job.id, runId: prRun._id.toString() });

    res.json({ ok: true, runId: prRun._id.toString() });
  } catch (error) {
    logger.error('api', 'Webhook error', { error: String(error), repo, prNumber, sha, delivery });
    if (error.code === 11000) {
      return res.status(409).json({ error: 'PR analysis already exists for this combination' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.API_PORT || 3001;
// --- Autofix API ---
const PatchRequest = require('../../shared/models/PatchRequest');

function uniq(arr) { return Array.from(new Set(arr)); }

// Create a preview for selected findings (progressive, no bulk AI; files processed on-demand)
app.post('/runs/:runId/patches/preview', async (req, res) => {
  try {
    const { runId } = req.params;
    const { selectedFindingIds } = req.body || {};
    if (!Array.isArray(selectedFindingIds) || selectedFindingIds.length === 0) {
      return res.status(400).json({ error: 'selectedFindingIds must be a non-empty array' });
    }

    const prRun = await PRRun.findById(runId);
    if (!prRun) return res.status(404).json({ error: 'Run not found' });

    const idsSet = new Set(selectedFindingIds.map(String));
    const selected = prRun.findings.filter(f => idsSet.has(String(f._id)));
    if (!selected.length) return res.status(400).json({ error: 'None of the selected findings exist in this run' });

    // Compute unique files and per-file finding IDs
    const filesMap = new Map();
    for (const f of selected) {
      if (!filesMap.has(f.file)) filesMap.set(f.file, new Set());
      filesMap.get(f.file).add(String(f._id));
    }

    // Create PatchRequest placeholder with file stubs (ready=false)
    const filesExpected = filesMap.size;
    const fileStubs = Array.from(filesMap.entries()).map(([file, set]) => ({ file, ready: false, findingIds: Array.from(set) }));

    const patch = new PatchRequest({
      runId,
      repo: prRun.repo,
      prNumber: prRun.prNumber,
      sha: prRun.sha,
      selectedFindingIds: uniq(selectedFindingIds.map(String)),
      status: 'preview_partial',
      preview: { unifiedDiff: '', files: fileStubs, filesExpected },
    });
    await patch.save();

    // Immediately enqueue ALL files for parallel processing
    const concurrency = parseInt(process.env.LLM_CONCURRENCY || '3', 10);
    const uniqueFiles = Array.from(filesMap.keys());
    logger.info('api', 'Enqueuing all files for preview', { patchRequestId: patch._id.toString(), fileCount: uniqueFiles.length, concurrency });
    
    const jobs = [];
    for (const file of uniqueFiles) {
      const job = autofixQueue.add('preview_file', { patchRequestId: patch._id.toString(), file });
      jobs.push(job);
    }
    await Promise.all(jobs);
    logger.info('api', 'All files enqueued', { patchRequestId: patch._id.toString(), jobCount: jobs.length });

    res.json({ ok: true, patchRequestId: patch._id.toString(), filesQueued: jobs.length });
  } catch (error) {
    logger.error('api', 'Preview error', { error: String(error) });
    res.status(500).json({ error: 'Failed to create preview' });
  }
});

// Apply a previously previewed patch
app.post('/runs/:runId/patches/apply', async (req, res) => {
  try {
    const { runId } = req.params;
    const { patchRequestId } = req.body || {};
    if (!patchRequestId) return res.status(400).json({ error: 'patchRequestId is required' });

    const patch = await PatchRequest.findById(patchRequestId);
    if (!patch || patch.runId !== runId) return res.status(404).json({ error: 'PatchRequest not found for this run' });
    if (!patch.preview || !patch.preview.files || patch.status !== 'preview_ready') {
      return res.status(400).json({ error: 'PatchRequest is not ready to apply (preview missing or status not preview_ready)' });
    }

    // Enqueue an autofix apply job
    const job = await autofixQueue.add('apply', { patchRequestId: patch._id.toString() });
    logger.info('api', 'Autofix apply enqueued', { jobId: job.id, patchRequestId: patch._id.toString() });

    res.json({ ok: true, patchRequestId: patch._id.toString() });
  } catch (error) {
    logger.error('api', 'Apply error', { error: String(error) });
    res.status(500).json({ error: 'Failed to enqueue apply' });
  }
});

// Get patch request status
app.get('/runs/:runId/patches/:patchRequestId', async (req, res) => {
  try {
    const { runId, patchRequestId } = req.params;
    const patch = await PatchRequest.findById(patchRequestId);
    if (!patch || patch.runId !== runId) return res.status(404).json({ error: 'PatchRequest not found for this run' });
    res.json(patch);
  } catch (error) {
    logger.error('api', 'Get patch error', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch patch request' });
  }
});

// List files for a patch (quick, without content)
app.get('/runs/:runId/patches/:patchRequestId/files', async (req, res) => {
  try {
    const { runId, patchRequestId } = req.params;
    const patch = await PatchRequest.findById(patchRequestId);
    if (!patch || patch.runId !== runId) return res.status(404).json({ error: 'PatchRequest not found for this run' });
    const files = (patch.preview?.files || []).map(f => ({ file: f.file, ready: !!f.ready }));
    const expected = patch.preview?.filesExpected || files.length;
    res.json({ files, expected, status: patch.status });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list patch files' });
  }
});

// Get or process a single file for a patch
app.get('/runs/:runId/patches/:patchRequestId/file', async (req, res) => {
  try {
    const { runId, patchRequestId } = req.params;
    const { file, process: proc } = req.query;
    if (!file) return res.status(400).json({ error: 'file is required' });
    const patch = await PatchRequest.findById(patchRequestId);
    if (!patch || patch.runId !== runId) return res.status(404).json({ error: 'PatchRequest not found for this run' });
    const entry = (patch.preview?.files || []).find(f => f.file === file);
    if (entry && entry.ready) {
      return res.json({ ready: true, file: entry.file, originalText: entry.originalText, improvedText: entry.improvedText, hunks: entry.hunks, unifiedDiff: entry.unifiedDiff });
    }
    if (String(proc) === '1') {
      // Enqueue single-file preview job
      const job = await autofixQueue.add('preview_file', { patchRequestId, file });
      logger.info('api', 'Enqueued single-file preview', { jobId: job.id, patchRequestId, file });
      return res.json({ ready: false, queued: true });
    }
    return res.json({ ready: false, queued: false });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch or enqueue file preview' });
  }
});

app.listen(PORT, () => logger.info('api', `listening`, { port: PORT }));
