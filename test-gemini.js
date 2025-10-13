require('dotenv').config();
const axios = require('axios');

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      role: 'user',
      parts: [{ text: 'Say hello in 5 words or less' }]
    }]
  };
  
  console.log('Testing Gemini API...');
  console.log('URL:', url.replace(apiKey, '***'));
  
  try {
    const startTime = Date.now();
    const { data } = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    const elapsed = Date.now() - startTime;
    
    console.log('✅ SUCCESS!');
    console.log('Time:', elapsed + 'ms');
    console.log('Response:', data.candidates[0].content.parts[0].text);
  } catch (error) {
    console.log('❌ FAILED');
    console.log('Status:', error.response?.status);
    console.log('Error:', JSON.stringify(error.response?.data || error.message, null, 2));
  }
}

testGemini();
