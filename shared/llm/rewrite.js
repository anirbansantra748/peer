const axios = require('axios');
const path = require('path');
const llmCache = require('../cache/llmCache');
const { cleanLLMResponse, validateCodeStructure } = require('./responseFilter');

function detectLanguage(file) {
  const ext = path.extname(file).toLowerCase();
  if (/\.(js|jsx)$/i.test(ext)) return 'javascript';
  if (/\.(ts|tsx)$/i.test(ext)) return 'typescript';
  if (/\.(py)$/i.test(ext)) return 'python';
  if (/\.(go)$/i.test(ext)) return 'go';
  if (/\.(java)$/i.test(ext)) return 'java';
  if (/\.(rb)$/i.test(ext)) return 'ruby';
  if (/\.(php)$/i.test(ext)) return 'php';
  if (/\.(cs)$/i.test(ext)) return 'csharp';
  if (/\.(c|h|cpp|hpp|cc|hh)$/i.test(ext)) return 'cpp';
  if (/\.(sql)$/i.test(ext)) return 'sql';
  if (/\.(sh|bash)$/i.test(ext)) return 'bash';
  if (/\.(yml|yaml)$/i.test(ext)) return 'yaml';
  if (/\.(json)$/i.test(ext)) return 'json';
  return 'generic';
}

// Detect if errors are simple or complex
function analyzeComplexity(findings) {
  const simpleRules = [
    'missing-semicolon', 'unused-variable', 'style-', 'typo',
    'naming-convention', 'whitespace', 'indentation', 'quotes',
    'trailing-comma', 'eqeqeq', 'no-console', 'prefer-const'
  ];
  const complexRules = [
    'sql-injection', 'xss', 'security-', 'logic-error',
    'race-condition', 'memory-leak', 'infinite-loop', 'auth-',
    'crypto-', 'injection', 'command-injection', 'path-traversal'
  ];
  
  let simpleCount = 0;
  let complexCount = 0;
  
  for (const f of findings || []) {
    const rule = String(f.rule || '').toLowerCase();
    const severity = String(f.severity || '').toLowerCase();
    
    // Check if it's a complex issue
    if (complexRules.some(r => rule.includes(r)) || severity === 'critical' || severity === 'high') {
      complexCount++;
    } else if (simpleRules.some(r => rule.includes(r)) || severity === 'low') {
      simpleCount++;
    } else {
      // Default to medium complexity
      simpleCount++;
    }
  }
  
  // If >50% are complex, route to complex model
  if (complexCount > simpleCount) return 'complex';
  return 'simple';
}

function buildPrompt({ file, code, findings }) {
  const language = detectLanguage(file);
  const issues = (findings || []).map(f => ({
    id: String(f._id || f.id || ''),
    rule: f.rule,
    severity: f.severity,
    message: f.message,
    line: f.line,
    analyzer: f.analyzer,
  }));
  const issuesJson = JSON.stringify(issues, null, 2);
  return {
    system: `You are a senior ${language} engineer. Fix the code issues while preserving behavior and structure. Add brief inline comments explaining each fix. Output ONLY the corrected file content with no explanations or code fences.`,
    user: `File: ${file}\nLanguage: ${language}\nIssues to fix:\n${issuesJson}\n\nIMPORTANT RULES:
1. Return ONLY the corrected code - no introductions like "Here's the corrected code"
2. NO explanatory text at the end like "Changes made:" or numbered lists
3. NO markdown code fences (\`\`\`)
4. Add INLINE comments next to each fix using // syntax:
   ✅ CORRECT: const x = true; // fixed: changed 'tru' to 'true'
   ❌ WRONG: At the end listing "1. Replaced tru with true"
5. Do NOT add multi-line comment blocks summarizing changes
6. Do NOT add numbered lists (1., 2., 3.) explaining changes

Return ONLY the corrected code with inline comments:\n\n${code}`
  };
}

async function callOpenAI({ system, user }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || process.env.LLM_MODEL || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';
  try {
const { data } = await axios.post(url, {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
  }, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: parseInt(process.env.LLM_TIMEOUT_MS || '20000', 10),
  });
    let text = data?.choices?.[0]?.message?.content || '';
    return { text: stripFences(text), modelUsed: model };
  } catch (e) {
    if (process.env.LLM_DEBUG === '1') {
      console.error('[LLM][OpenAI] error', e?.response?.status, e?.response?.data || String(e));
    }
    throw e;
  }
}

function geminiModelCandidates() {
  const envModel = (process.env.GEMINI_MODEL || '').trim();
  const candidates = [];
  if (envModel) candidates.push(envModel);
  // Common public/free-tier models to try
  candidates.push('gemini-1.5-flash-8b-latest');
  candidates.push('gemini-1.5-flash-8b');
  candidates.push('gemini-1.5-flash-latest');
  candidates.push('gemini-1.5-pro-latest');
  candidates.push('gemini-1.5-pro');
  return Array.from(new Set(candidates));
}

async function callGroq({ system, user }) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  try {
    const startTime = Date.now();
    const { data } = await axios.post(url, {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: parseInt(process.env.LLM_TIMEOUT_MS || '20000', 10),
    });
    const responseTime = Date.now() - startTime;
    let text = data?.choices?.[0]?.message?.content || '';
    if (process.env.LLM_DEBUG === '1') {
      console.log('[LLM][Groq] success', { model, responseTime: `${responseTime}ms`, tokens: data?.usage?.total_tokens });
    }
    return { text: stripFences(text), modelUsed: model, provider: 'groq', responseTime };
  } catch (e) {
    if (process.env.LLM_DEBUG === '1') {
      console.error('[LLM][Groq] error', e?.response?.status, e?.response?.data || String(e));
    }
    throw e;
  }
}

async function callDeepSeek({ system, user }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-coder';
  const url = 'https://api.deepseek.com/v1/chat/completions';
  try {
    const startTime = Date.now();
    const { data } = await axios.post(url, {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: parseInt(process.env.LLM_TIMEOUT_MS || '20000', 10),
    });
    const responseTime = Date.now() - startTime;
    let text = data?.choices?.[0]?.message?.content || '';
    if (process.env.LLM_DEBUG === '1') {
      console.log('[LLM][DeepSeek] success', { model, responseTime: `${responseTime}ms`, tokens: data?.usage?.total_tokens });
    }
    return { text: stripFences(text), modelUsed: model, provider: 'deepseek', responseTime };
  } catch (e) {
    if (process.env.LLM_DEBUG === '1') {
      console.error('[LLM][DeepSeek] error', e?.response?.status, e?.response?.data || String(e));
    }
    throw e;
  }
}

async function callOpenRouter({ system, user }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct';
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  try {
    const startTime = Date.now();
    const { data } = await axios.post(url, {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/anirbansantra748/peer',
        'X-Title': 'Peer AI Code Review'
      },
      timeout: parseInt(process.env.LLM_TIMEOUT_MS || '20000', 10),
    });
    const responseTime = Date.now() - startTime;
    let text = data?.choices?.[0]?.message?.content || '';
    if (process.env.LLM_DEBUG === '1') {
      console.log('[LLM][OpenRouter] success', { model, responseTime: `${responseTime}ms`, tokens: data?.usage?.total_tokens });
    }
    return { text: stripFences(text), modelUsed: model, provider: 'openrouter', responseTime };
  } catch (e) {
    if (process.env.LLM_DEBUG === '1') {
      console.error('[LLM][OpenRouter] error', e?.response?.status, e?.response?.data || String(e));
    }
    throw e;
  }
}

async function callGemini({ system, user }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const baseUrl = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta/models';
  
  const payload = {
    contents: [
      { role: 'user', parts: [{ text: `${system}\n\n${user}` }] }
    ]
  };
  
  const url = `${baseUrl}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  
  try {
    const startTime = Date.now();
    const { data } = await axios.post(url, payload, { 
      headers: { 'Content-Type': 'application/json' }, 
      timeout: parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10) 
    });
    const responseTime = Date.now() - startTime;
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    
    if (process.env.LLM_DEBUG === '1') {
      console.log('[LLM][Gemini] success', { model, responseTime: `${responseTime}ms` });
    }
    
    if (text && text.trim()) {
      return { text: stripFences(text), modelUsed: model, provider: 'gemini', responseTime };
    }
    return { text: '' };
  } catch (e) {
    if (process.env.LLM_DEBUG === '1') {
      const safeUrl = String(url).replace(/key=[^&]+/, 'key={{GEMINI_API_KEY}}');
      console.error('[LLM][Gemini] error', safeUrl, e?.response?.status, e?.response?.data || String(e));
    }
    throw e;
  }
}

function stripFences(s) {
  const text = String(s || '').trim();
  // Remove Markdown fences if present
  let cleaned = text.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
  
  // Use advanced response filter to remove explanatory text
  cleaned = cleanLLMResponse(cleaned, { filename: 'LLM response' });
  
  return cleaned;
}

async function rewriteFileWithAI({ file, code, findings }) {
  const { system, user } = buildPrompt({ file, code, findings });
  const complexity = analyzeComplexity(findings);
  
  // Check cache first
  const cachedResult = await llmCache.get(file, code, findings);
  if (cachedResult) {
    if (process.env.LLM_DEBUG === '1') {
      console.log('[LLM][Cache] HIT', { file, model: cachedResult.model });
    }
    return { 
      text: cachedResult.text, 
      modelUsed: cachedResult.model, 
      provider: 'cache',
      responseTime: 0,
      cached: true 
    };
  }
  
  // Check available providers
  const haveGroq = !!process.env.GROQ_API_KEY;
  const haveDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const haveGemini = !!process.env.GEMINI_API_KEY;
  const haveOpenAI = !!process.env.OPENAI_API_KEY;
  const haveOpenRouter = !!process.env.OPENROUTER_API_KEY;
  
  // Manual provider override
  const provider = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (provider === 'groq' && haveGroq) {
    try { 
      const result = await callGroq({ system, user });
      await llmCache.set(file, code, findings, result.text, result.modelUsed, result.responseTime);
      return result;
    } catch (e) {
      if (process.env.LLM_DEBUG === '1') console.error('[LLM] Groq failed, no fallback');
    }
    return { text: '' };
  }
  if (provider === 'deepseek' && haveDeepSeek) {
    try { 
      const result = await callDeepSeek({ system, user });
      await llmCache.set(file, code, findings, result.text, result.modelUsed, result.responseTime);
      return result;
    } catch (e) {
      if (process.env.LLM_DEBUG === '1') console.error('[LLM] DeepSeek failed, no fallback');
    }
    return { text: '' };
  }
  if (provider === 'openrouter' && haveOpenRouter) {
    try { 
      const result = await callOpenRouter({ system, user });
      await llmCache.set(file, code, findings, result.text, result.modelUsed, result.responseTime);
      return result;
    } catch (e) {
      if (process.env.LLM_DEBUG === '1') console.error('[LLM] OpenRouter failed, no fallback');
    }
    return { text: '' };
  }
  if (provider === 'gemini' && haveGemini) {
    try { 
      const result = await callGemini({ system, user });
      await llmCache.set(file, code, findings, result.text, result.modelUsed, result.responseTime);
      return result;
    } catch {}
    return { text: '' };
  }
  if (provider === 'openai' && haveOpenAI) {
    try { 
      const result = await callOpenAI({ system, user });
      await llmCache.set(file, code, findings, result.text, result.modelUsed, result.responseTime);
      return result;
    } catch {}
    return { text: '' };
  }

  // Smart routing based on complexity
  let out = { text: '' };
  
  if (complexity === 'simple') {
    // Simple fixes: Use Groq (fastest) -> OpenRouter -> Gemini -> DeepSeek
    if (haveGroq) {
      try { 
        out = await callGroq({ system, user }); 
        if (out.text && out.text.trim()) {
          await llmCache.set(file, code, findings, out.text, out.modelUsed, out.responseTime);
          return out;
        }
      } catch (e) {
        if (process.env.LLM_DEBUG === '1') console.log('[LLM] Groq failed, trying fallback');
      }
    }
    if (haveOpenRouter) {
      try { 
        out = await callOpenRouter({ system, user }); 
        if (out.text && out.text.trim()) {
          await llmCache.set(file, code, findings, out.text, out.modelUsed, out.responseTime);
          return out;
        }
      } catch (e) {
        if (process.env.LLM_DEBUG === '1') console.log('[LLM] OpenRouter failed, trying fallback');
      }
    }
    if (haveGemini) {
      try { 
        out = await callGemini({ system, user }); 
        if (out.text && out.text.trim()) {
          await llmCache.set(file, code, findings, out.text, out.modelUsed, out.responseTime);
          return out;
        }
      } catch (e) {
        if (process.env.LLM_DEBUG === '1') console.log('[LLM] Gemini failed, trying fallback');
      }
    }
    if (haveDeepSeek) {
      try { 
        out = await callDeepSeek({ system, user });
        if (out.text && out.text.trim()) {
          await llmCache.set(file, code, findings, out.text, out.modelUsed, out.responseTime);
        }
      } catch {}
    }
  } else {
    // Complex fixes: Use DeepSeek (code specialist) -> Gemini -> Groq -> OpenRouter
    if (haveDeepSeek) {
      try { 
        out = await callDeepSeek({ system, user }); 
        if (out.text && out.text.trim()) {
          await llmCache.set(file, code, findings, out.text, out.modelUsed, out.responseTime);
          return out;
        }
      } catch (e) {
        if (process.env.LLM_DEBUG === '1') console.log('[LLM] DeepSeek failed, trying fallback');
      }
    }
    if (haveGemini) {
      try { 
        out = await callGemini({ system, user }); 
        if (out.text && out.text.trim()) {
          await llmCache.set(file, code, findings, out.text, out.modelUsed, out.responseTime);
          return out;
        }
      } catch (e) {
        if (process.env.LLM_DEBUG === '1') console.log('[LLM] Gemini failed, trying fallback');
      }
    }
    if (haveGroq) {
      try { 
        out = await callGroq({ system, user });
        if (out.text && out.text.trim()) {
          await llmCache.set(file, code, findings, out.text, out.modelUsed, out.responseTime);
          return out;
        }
      } catch {}
    }
    if (haveOpenRouter) {
      try { 
        out = await callOpenRouter({ system, user });
        if (out.text && out.text.trim()) {
          await llmCache.set(file, code, findings, out.text, out.modelUsed, out.responseTime);
        }
      } catch {}
    }
  }
  
  return out;
}

async function planMinimalFixesWithAI({ file, code, findings }) {
  // Return JSON patches: [{ findingId, line, newCode, reason, warn? }]
  // Rules for the LLM:
  // - Only fix the provided findings; do not modify unrelated code.
  // - Keep the file identical except for minimal changes at the specified lines.
  // - If a multi-line change is absolutely required, include newCode with \n breaks.
  // - Do not add new functions/imports unless strictly necessary for the fix.
  // - Do not reformat the file or rename identifiers.
  // - If a fix removes a secret, set newCode to use an environment placeholder and include warn: 'removed secret; add to environment and rotate'.
  const language = detectLanguage(file);
  const simpleFindings = (findings || []).map(f => ({
    findingId: String(f._id || f.id || ''),
    line: f.line,
    rule: f.rule,
    severity: f.severity,
    message: f.message,
  }));
  const guide = [
    'You are a strict fixer. Only fix the specific issues listed. No other changes.',
    'Output JSON array only, no code fences:',
    '[{"findingId":"...","line":123,"newCode":"...","reason":"6-10 words","warn":"optional short"}]',
    'Constraints:',
    '- Change only the target line(s). If trailing semicolon is missing, just add it.',
    '- If the fix requires minimal surrounding context (e.g., add await), you may update that line.',
    '- Do not add new functions/imports unless absolutely necessary.',
    '- Do not change variable names, comments, or formatting except where necessary to fix the issue.',
    '- If a hardcoded secret exists, replace with env placeholder (e.g., process.env.NAME) and include warn.',
  ].join('\n');
  const system = `You are a senior ${language} engineer providing minimal patches only for the provided findings. Output JSON patches only.`;
  const user = `File: ${file}\nLanguage: ${language}\nFindings to fix (JSON):\n${JSON.stringify(simpleFindings, null, 2)}\n\nFull file content follows for context. Provide ONLY a JSON array of patches as specified.\nBEGIN_FILE\n${code}\nEND_FILE\n\n${guide}`;

  const complexity = analyzeComplexity(findings);
  const haveGroq = !!process.env.GROQ_API_KEY;
  const haveDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const haveGemini = !!process.env.GEMINI_API_KEY;
  const haveOpenAI = !!process.env.OPENAI_API_KEY;
  
  let out = { text: '' };
  try {
    // Use smart routing
    if (complexity === 'simple' && haveGroq) {
      out = await callGroq({ system, user });
    } else if (complexity === 'complex' && haveDeepSeek) {
      out = await callDeepSeek({ system, user });
    } else if (haveGemini) {
      out = await callGemini({ system, user });
    } else if (haveOpenAI) {
      out = await callOpenAI({ system, user });
    }
  } catch (e) {
    // Fallback on error
    try {
      if (haveGemini) out = await callGemini({ system, user });
      else if (haveGroq) out = await callGroq({ system, user });
    } catch {}
  }

  if (!out.text || !out.text.trim()) return { patches: [], provider: (process.env.LLM_PROVIDER||'').toLowerCase() || 'auto', model: out.modelUsed || '', timestamp: new Date().toISOString() };
  const text = out.text.trim();
  // Try to extract JSON array
  let jsonStr = text;
  const match = text.match(/\[[\s\S]*\]/);
  if (match) jsonStr = match[0];
  try {
    const patches = JSON.parse(jsonStr);
    if (Array.isArray(patches)) {
      return { patches: patches.filter(p => p && p.line && typeof p.newCode === 'string'), provider: (process.env.LLM_PROVIDER||'').toLowerCase() || 'auto', model: out.modelUsed || '', timestamp: new Date().toISOString() };
    }
  } catch {}
  return { patches: [], provider: (process.env.LLM_PROVIDER||'').toLowerCase() || 'auto', model: out.modelUsed || '', timestamp: new Date().toISOString() };
}

module.exports = { rewriteFileWithAI, detectLanguage, planMinimalFixesWithAI, geminiModelCandidates, analyzeComplexity };
