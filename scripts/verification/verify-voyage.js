require('dotenv').config();
const { VoyageEmbeddings } = require('@langchain/community/embeddings/voyage');

async function verifyVoyage() {
    console.log('🔍 Verifying Voyage AI...');

    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
        console.error('❌ Missing VOYAGE_API_KEY in .env');
        return;
    }

    try {
        const embeddings = new VoyageEmbeddings({
            apiKey,
            modelName: 'voyage-code-3'
        });

        const text = "Hello World";
        console.log(`   Generating embedding for: "${text}"`);

        const vector = await embeddings.embedQuery(text);

        if (vector && vector.length > 0) {
            console.log(`✅ Voyage AI Working!`);
            console.log(`   Vector Dimensions: ${vector.length}`);
            console.log(`   Sample: [${vector.slice(0, 3).join(', ')}...]`);
        } else {
            console.error('❌ Received empty vector from Voyage AI');
        }

    } catch (error) {
        console.error('❌ Voyage AI Verification Failed:', error.message);
    }
}

verifyVoyage();
