const axios = require('axios');
require('dotenv').config();

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HF_API_URL = 'https://router.huggingface.co/models';

// Models to test
const MODELS_TO_TEST = [
    {
        name: 'Qwen2.5-Coder-7B',
        id: 'Qwen/Qwen2.5-Coder-7B-Instruct',
        description: 'Latest Qwen code model - excellent for code generation'
    },
    {
        name: 'DeepSeek-Coder-6.7B',
        id: 'deepseek-ai/deepseek-coder-6.7b-instruct',
        description: 'DeepSeek code specialist model'
    },
    {
        name: 'CodeLlama-13B',
        id: 'codellama/CodeLlama-13b-Instruct-hf',
        description: 'Meta\'s code-focused Llama model'
    }
];

async function testHuggingFaceModel(model) {
    console.log(`\n🧪 Testing ${model.name}...`);
    console.log(`   Model ID: ${model.id}`);
    console.log(`   Description: ${model.description}`);

    const url = `${HF_API_URL}/${model.id}`;

    const testPrompt = `Fix this JavaScript code:\nconst x = tru;\nconsole.log(x);\n\nThe issue is 'tru' should be 'true'. Return only the corrected code.`;

    try {
        const startTime = Date.now();

        const response = await axios.post(
            url,
            {
                inputs: testPrompt,
                parameters: {
                    max_new_tokens: 512,
                    temperature: 0.2,
                    return_full_text: false
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${HF_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 seconds
            }
        );

        const responseTime = Date.now() - startTime;

        // HuggingFace returns different response formats
        let generatedText = '';
        if (Array.isArray(response.data)) {
            generatedText = response.data[0]?.generated_text || response.data[0]?.text || '';
        } else if (response.data.generated_text) {
            generatedText = response.data.generated_text;
        } else {
            generatedText = JSON.stringify(response.data);
        }

        console.log(`   ✅ SUCCESS!`);
        console.log(`   Response time: ${responseTime}ms`);
        console.log(`   Preview: ${generatedText.substring(0, 100)}...`);

        return {
            success: true,
            model: model.name,
            modelId: model.id,
            responseTime,
            preview: generatedText.substring(0, 200)
        };

    } catch (error) {
        console.log(`   ❌ FAILED!`);

        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            console.log(`   Status: ${status}`);

            if (status === 503) {
                console.log(`   Error: Model is loading... (This is normal, try again in a minute)`);
                console.log(`   Estimated time: ${data?.estimated_time || 'unknown'}`);
            } else if (status === 401) {
                console.log(`   Error: Invalid API key`);
            } else if (status === 404) {
                console.log(`   Error: Model not found`);
            } else {
                console.log(`   Error: ${JSON.stringify(data)}`);
            }
        } else if (error.code === 'ECONNABORTED') {
            console.log(`   Error: Request timeout (model might be too slow)`);
        } else {
            console.log(`   Error: ${error.message}`);
        }

        return {
            success: false,
            model: model.name,
            modelId: model.id,
            error: error.response?.data || error.message
        };
    }
}

async function runAllTests() {
    console.log('🚀 Starting HuggingFace Model Tests\n');
    console.log(`API Key: ${HF_API_KEY.substring(0, 10)}...${HF_API_KEY.substring(HF_API_KEY.length - 5)}`);
    console.log('='.repeat(60));

    const results = [];

    for (const model of MODELS_TO_TEST) {
        const result = await testHuggingFaceModel(model);
        results.push(result);

        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL RESULTS\n');

    const successfulModels = results.filter(r => r.success);
    const failedModels = results.filter(r => !r.success);

    console.log(`✅ Successful: ${successfulModels.length}/${results.length}`);
    successfulModels.forEach(r => {
        console.log(`   - ${r.model} (${r.responseTime}ms)`);
    });

    if (failedModels.length > 0) {
        console.log(`\n❌ Failed: ${failedModels.length}/${results.length}`);
        failedModels.forEach(r => {
            console.log(`   - ${r.model}`);
        });
    }

    console.log('\n💡 RECOMMENDATIONS:\n');
    if (successfulModels.length > 0) {
        console.log(`Use these models as fallbacks in your system:`);
        successfulModels.forEach(r => {
            console.log(`   - ${r.modelId}`);
        });
    } else {
        console.log(`All models failed. Check:`);
        console.log(`   1. API key validity`);
        console.log(`   2. Try again (models might be loading)`);
        console.log(`   3. Check HuggingFace status page`);
    }
}

runAllTests();
