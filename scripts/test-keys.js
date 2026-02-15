const { QdrantClient } = require('@qdrant/js-client-rest');
const axios = require('axios');
require('dotenv').config();

async function testKeys() {
    console.log('🔑 Testing API Keys...\n');

    // 1. Test Qdrant
    try {
        console.log('Testing Qdrant...');
        const client = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });
        const collections = await client.getCollections();
        console.log('✅ Qdrant Connected! Collections:', collections.collections.length);
    } catch (error) {
        console.error('❌ Qdrant Failed:', error.message);
        if (error.code === 'ENOTFOUND') {
            console.log('   (Hint: Check QDRANT_URL. It should look like https://xyz.us-east-1.aws.cloud.qdrant.io)');
        }
    }

    // 2. Test Voyage AI
    try {
        console.log('\nTesting Voyage AI...');
        const res = await axios.post(
            'https://api.voyageai.com/v1/embeddings',
            { input: "test", model: "voyage-code-3" },
            { headers: { 'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}` } }
        );
        if (res.data && res.data.data) {
            console.log('✅ Voyage AI Working! Embedding generated.');
        } else {
            throw new Error('No data returned');
        }
    } catch (error) {
        console.error('❌ Voyage AI Failed:', error.response?.data || error.message);
    }

    // 3. Test Groq
    try {
        console.log('\nTesting Groq...');
        const res = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.3-70b-versatile", // Updated from deprecated mixtral-8x7b-32768
                messages: [{ role: "user", content: "Hello" }]
            },
            { headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` } }
        );
        if (res.data && res.data.choices) {
            console.log('✅ Groq Working! Response received.');
        } else {
            throw new Error('No choices returned');
        }
    } catch (error) {
        console.error('❌ Groq Failed:', error.response?.data || error.message);
    }

    // 4. Test Gemini
    try {
        console.log('\nTesting Gemini...');
        // Use gemini-2.0-flash-exp which is available in v1beta
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const res = await axios.post(
            url,
            { contents: [{ parts: [{ text: "Hello" }] }] }
        );
        if (res.data && res.data.candidates) {
            console.log('✅ Gemini Working! Response received.');
        } else {
            throw new Error('No candidates returned');
        }
    } catch (error) {
        console.error('❌ Gemini Failed:', error.response?.data?.error?.message || error.message);
        console.log('   (Note: If free tier is "cooked", check quota or try alternative)');
    }
}

testKeys();
