require('dotenv').config();
const { QdrantClient } = require('@qdrant/js-client-rest');

async function verifyQdrant() {
  console.log('🔍 Verifying Qdrant Cloud...');

  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url || !apiKey) {
    console.error('❌ Missing QDRANT_URL or QDRANT_API_KEY in .env');
    return;
  }

  try {
    const cleanUrl = url.replace(':6333', '');
    console.log(`   Connecting to: ${cleanUrl}`);
    const client = new QdrantClient({ url: cleanUrl, apiKey, checkCompatibility: false });
    const response = await client.getCollections();

    console.log('✅ Connected to Qdrant!');
    console.log('   Collections found:');
    if (response.collections.length === 0) {
      console.log('   (No collections yet)');
    } else {
      response.collections.forEach(c => console.log(`   - ${c.name}`));
    }

  } catch (error) {
    console.error('❌ Qdrant Verification Failed:', error.message);
  }
}

verifyQdrant();
