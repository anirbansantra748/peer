require('dotenv').config();
const axios = require('axios');

async function debugQdrant() {
    let url = process.env.QDRANT_URL;
    url = url.replace(':6333', '');
    const apiKey = process.env.QDRANT_API_KEY;

    console.log(`Debugging URL (no port): ${url}`);

    // Try hitting root
    try {
        console.log('GET / ...');
        const res = await axios.get(url, { headers: { 'api-key': apiKey } });
        console.log('Status:', res.status);
        console.log('Data:', res.data);
    } catch (e) {
        console.log('GET / failed:', e.message);
        if (e.response) console.log('Response:', e.response.status, e.response.data);
    }

    // Try hitting /collections
    try {
        const collectionsUrl = url.endsWith('/') ? `${url}collections` : `${url}/collections`;
        console.log(`GET ${collectionsUrl} ...`);
        const res = await axios.get(collectionsUrl, { headers: { 'api-key': apiKey } });
        console.log('Status:', res.status);
        console.log('Data:', res.data);
    } catch (e) {
        console.log('GET /collections failed:', e.message);
        if (e.response) console.log('Response:', e.response.status, e.response.data);
    }
}

debugQdrant();
