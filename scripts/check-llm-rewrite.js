require('dotenv').config();
process.env.LLM_DEBUG = process.env.LLM_DEBUG || '1';
const { rewriteFileWithAI } = require('../shared/llm/rewrite');

(async () => {
  const haveOpenAI = !!process.env.OPENAI_API_KEY;
  const haveGemini = !!process.env.GEMINI_API_KEY;
  if (!haveOpenAI && !haveGemini) {
    console.error('NO_KEYS');
    process.exit(2);
  }

  const file = 'demo.js';
  const code = `const express = require('express');
const fs = require('fs');
const router = express.Router();

router.get('/read', (req, res) => {
  const filePath = req.query.path; // potential path traversal
  const content = fs.readFileSync(filePath, 'utf-8'); // sync IO
  res.send(content);
});

module.exports = router;`;

  const findings = [
    { rule: 'path-traversal', severity: 'high', message: 'Unvalidated file path from user input', line: 6, analyzer: 'security' },
    { rule: 'sync-io', severity: 'medium', message: 'Synchronous IO blocks event loop', line: 7, analyzer: 'performance' },
  ];

  try {
    const out = await rewriteFileWithAI({ file, code, findings });
    const changed = (out && out.trim() !== code.trim());
    console.log(JSON.stringify({ ok: true, haveOpenAI, haveGemini, changed, outLen: (out||'').length }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e.message || e) }));
    process.exit(1);
  }
})();