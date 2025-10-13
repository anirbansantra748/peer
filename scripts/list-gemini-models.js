require('dotenv').config();
const axios = require('axios');

(async () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('Missing GEMINI_API_KEY');
    process.exit(2);
  }
  const urls = [
    `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`,
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
  ];
  for (const url of urls) {
    try {
      const { data } = await axios.get(url, { timeout: 20000 });
      const names = (data?.models || []).map(m => m.name).slice(0, 50);
      console.log(JSON.stringify({ ok: true, endpoint: url.replace(/key=[^&]+/, 'key={{GEMINI_API_KEY}}'), count: names.length, names }));
    } catch (e) {
      console.log(JSON.stringify({ ok: false, endpoint: url.replace(/key=[^&]+/, 'key={{GEMINI_API_KEY}}'), status: e?.response?.status, error: e?.response?.data || String(e) }));
    }
  }
})();