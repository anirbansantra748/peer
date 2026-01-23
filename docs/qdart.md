import {QdrantClient} from '@qdrant/js-client-rest';

const client = new QdrantClient({
    url: 'https://298c3cc4-ccac-40cc-a02b-36e8c5cb3d19.us-east4-0.gcp.cloud.qdrant.io:6333',
    apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.DGwv9PKWLieQdP34UQ8LFJGcLaTsOHug3-5_Hze8q7w',
});

try {
    const result = await client.getCollections();
    console.log('List of collections:', result.collections);
} catch (err) {
    console.error('Could not get collections:', err);
}