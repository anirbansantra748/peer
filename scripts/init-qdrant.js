const { QdrantClient } = require('@qdrant/js-client-rest');
require('dotenv').config();

async function initializeQdrant() {
    // Fix for Qdrant Cloud 404 issue: remove port if present in URL standard scheme
    let url = process.env.QDRANT_URL;
    if (url && url.includes('qdrant.io') && url.includes(':6333')) {
        url = url.replace(':6333', '');
    }

    const apiKey = process.env.QDRANT_API_KEY;

    if (!url || !apiKey) {
        console.error('❌ QDRANT_URL or QDRANT_API_KEY is missing in .env');
        process.exit(1);
    }

    console.log(`Connecting to Qdrant at ${url}...`);

    // Disable compatibility check to avoid version errors
    const client = new QdrantClient({ url, apiKey, checkCompatibility: false });

    const COLLECTION_NAME = 'code-findings';
    const VECTOR_SIZE = 1024; // Voyage-code-3 dimension

    try {
        // Check if collection exists
        const collections = await client.getCollections();
        const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

        if (exists) {
            console.log(`⚠️ Collection '${COLLECTION_NAME}' already exists.`);
        } else {
            console.log(`Creating collection '${COLLECTION_NAME}'...`);
            await client.createCollection(COLLECTION_NAME, {
                vectors: {
                    size: VECTOR_SIZE,
                    distance: 'Cosine'
                },
                optimizers_config: {
                    indexing_threshold: 10000
                }
            });
            console.log(`✅ Collection '${COLLECTION_NAME}' created.`);
        }

        // Create Payload Indexes
        console.log('Creating payload indexes...');

        await client.createPayloadIndex(COLLECTION_NAME, {
            field_name: 'severity',
            field_schema: 'keyword'
        });

        await client.createPayloadIndex(COLLECTION_NAME, {
            field_name: 'category',
            field_schema: 'keyword'
        });

        await client.createPayloadIndex(COLLECTION_NAME, {
            field_name: 'fixApplied',
            field_schema: 'bool'
        });

        // Add index for repo/owner to filter by repository
        await client.createPayloadIndex(COLLECTION_NAME, {
            field_name: 'repo',
            field_schema: 'keyword'
        });

        console.log('✅ Payload indexes created/verified.');

    } catch (error) {
        console.error('❌ Error initializing Qdrant:', error);
        process.exit(1);
    }
}

initializeQdrant();
