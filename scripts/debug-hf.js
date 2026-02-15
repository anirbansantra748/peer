const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.HUGGINGFACE_API_KEY;

const ENDPOINTS = [
    'https://router.huggingface.co/hf-inference/models',
    'https://router.huggingface.co/models',
    'https://api-inference.huggingface.co/models'
];

const MODELS = [
    'Qwen/Qwen2.5-Coder-32B-Instruct',
    'Qwen/Qwen2.5-Coder-7B-Instruct',
    'Qwen/Qwen2.5-Coder-1.5B-Instruct',
    'microsoft/Phi-3-mini-4k-instruct'
];

async function testCombination(endpoint, model) {
    const url = `${endpoint}/${model}`;
    console.log(`Checking ${url}...`);
    try {
        const { data } = await axios.post(url, {
            inputs: "console.log('test');",
            parameters: { max_new_tokens: 10 }
        }, {
            headers: { Authorization: `Bearer ${API_KEY}` },
            timeout: 5000
        });
        console.log(`✅ SUCCESS: ${model} on ${endpoint}`);
        return true;
    } catch (e) {
        if (e.response) {
            console.log(`❌ ${e.response.status} ${e.response.statusText}`);
            if (e.response.status === 410) console.log(`   (API Deprecated)`);
        } else {
            console.log(`❌ ${e.message}`);
        }
        return false;
    }
}

async function run() {
    console.log('🔎 Debugging HuggingFace Connection...\n');
    let working = false;

    for (const endpoint of ENDPOINTS) {
        for (const model of MODELS) {
            if (await testCombination(endpoint, model)) {
                working = true;
                console.log(`\n🎉 FOUND WORKING CONFIGURATION!`);
                console.log(`Endpoint: ${endpoint}`);
                console.log(`Model: ${model}`);
                break;
            }
        }
        if (working) break;
    }

    if (!working) {
        console.log('\n❌ No working configurations found.');
    }
}

run();
