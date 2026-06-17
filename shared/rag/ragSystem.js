const { QdrantClient } = require('@qdrant/js-client-rest');
const { VoyageEmbeddings } = require('@langchain/community/embeddings/voyage');
require('dotenv').config();

class RAGSystem {
    constructor() {
        let url = process.env.QDRANT_URL;
        if (url && url.includes('qdrant.io') && url.includes(':6333')) {
            url = url.replace(':6333', '');
        }

        this.qdrant = new QdrantClient({
            url,
            apiKey: process.env.QDRANT_API_KEY,
            checkCompatibility: false
        });

        this.embeddings = new VoyageEmbeddings({
            apiKey: process.env.VOYAGE_API_KEY,
            modelName: 'voyage-code-3' // Optimized for code
        });

        this.COLLECTION_NAME = 'code-findings';
    }

    /**
     * Generates embedding for a finding and stores it in Qdrant.
     * @param {Object} finding - The finding object from MongoDB
     * @returns {Promise<void>}
     */
    async storeFinding(finding) {
        if (!finding || !finding.message) {
            console.warn('[RAG] Invalid finding object provided for storage');
            return;
        }

        try {
            const embedding = await this.generateEmbedding(finding);

            await this.qdrant.upsert(this.COLLECTION_NAME, {
                wait: true,
                points: [{
                    id: finding._id.toString(),
                    vector: embedding,
                    payload: {
                        severity: finding.severity,
                        category: finding.category || 'unknown',
                        message: finding.message,
                        file: finding.file,
                        repo: finding.repo,
                        fixApplied: finding.fixApplied || false,
                        createdAt: finding.createdAt ? finding.createdAt.toISOString() : new Date().toISOString()
                    }
                }]
            });
            console.log(`[RAG] Stored finding ${finding._id} in Qdrant`);
        } catch (error) {
            console.error(`[RAG] Error storing finding ${finding._id}:`, error);
            throw error;
        }
    }

    /**
     * Search for similar findings in Qdrant.
     * @param {Object} finding - The current finding to match against
     * @param {number} topK - Number of results to return
     * @returns {Promise<Array>} - Array of similar findings with scores
     */
    async querySimilarFindings(finding, topK = 5) {
        try {
            const embedding = await this.generateEmbedding(finding);

            const results = await this.qdrant.search(this.COLLECTION_NAME, {
                vector: embedding,
                limit: topK,
                // Filter strategy:
                // 1. Prefer fixed issues
                // 2. Match severity
                filter: {
                    must: [
                        { key: 'severity', match: { value: finding.severity } }
                    ],
                    should: [
                        { key: 'fixApplied', match: { value: true } }
                    ]
                }
            });

            return results.map(r => ({
                score: r.score,
                finding: r.payload,
                relevance: r.score > 0.82 ? 'high' : (r.score > 0.75 ? 'medium' : 'low')
            }));
        } catch (error) {
            console.error('[RAG] Error querying similar findings:', error);
            return [];
        }
    }

    /**
     * Generates embedding vector for a finding.
     * @param {Object} finding 
     * @returns {Promise<Array<number>>}
     */
    async generateEmbedding(finding) {
        const text = this.formatFindingForEmbedding(finding);
        // embedQuery returns a single vector (array of numbers)
        const embedding = await this.embeddings.embedQuery(text);
        return embedding;
    }

    formatFindingForEmbedding(finding) {
        // Combine relevant fields into searchable text
        // We prioritize message and snippet for semantic similarity
        return `
      Severity: ${finding.severity}
      Category: ${finding.category}
      Message: ${finding.message}
      File: ${finding.file}
      Repo: ${finding.repo}
      Code Snippet: ${finding.snippet || ''}
    `.trim();
    }
}

module.exports = new RAGSystem();
