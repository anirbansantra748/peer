const { rewriteFileWithAI } = require('../shared/llm/rewrite');
require('dotenv').config();

async function testFallbacks() {
    console.log('🚀 Testing AI Fallback System\n');
    console.log('This script will attempt to use each provider specifically to verify they work.');
    console.log('---------------------------------------------------\n');

    const testFile = 'test.js';
    const testCode = 'const x = tru; // Error: typo';
    const findings = [{
        rule: 'typo',
        message: "Identifier 'tru' is not defined. Did you mean 'true'?",
        line: 1,
        severity: 'high'
    }];

    const providers = [
        { name: 'Groq', envKey: 'GROQ_API_KEY' },
        { name: 'Gemini', envKey: 'GEMINI_API_KEY' },
        { name: 'HuggingFace', envKey: 'HUGGINGFACE_API_KEY' },
        { name: 'Together', envKey: 'TOGETHER_API_KEY' },
        { name: 'Cerebras', envKey: 'CEREBRAS_API_KEY' }
    ];

    for (const p of providers) {
        process.env.LLM_PROVIDER = p.name.toLowerCase();

        console.log(`\n🧪 Testing Provider: ${p.name}...`);

        if (!process.env[p.envKey]) {
            console.log(`   ⏭️  Skipping: No API key found for ${p.envKey}`);
            continue;
        }

        try {
            const start = Date.now();
            const result = await rewriteFileWithAI({
                file: testFile,
                code: testCode,
                findings: findings
            });
            const duration = Date.now() - start;

            if (result && result.text && result.text.includes('true')) {
                console.log(`   ✅ SUCCESS (${duration}ms)`);
                console.log(`      Model used: ${result.modelUsed}`);
                console.log(`      Response: ${result.text.trim().substring(0, 50).replace(/\n/g, ' ')}...`);
            } else {
                console.log(`   ❌ FAILED: Invalid response`);
                console.log(`      Output: ${JSON.stringify(result)}`);
            }
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
        }
    }

    console.log('\n---------------------------------------------------');
    console.log('✅ Fallback System Verification Complete');
}

testFallbacks();
