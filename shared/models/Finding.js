const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema({
    prRunId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PRRun',
        required: true,
        index: true
    },

    // Finding details
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true
    },
    category: {
        type: String, // e.g., 'security', 'style', 'performance'
        required: true,
        index: true
    },
    message: String,
    file: String,
    line: Number,
    snippet: String,

    // Metadata
    repo: String, // e.g., 'owner/repo'
    installationId: String,

    // Fix tracking
    fixApplied: {
        type: Boolean,
        default: false
    },
    fixCommitSha: String,
    fixPrNumber: Number,

    // Embedding status
    embeddingGenerated: {
        type: Boolean,
        default: false
    },
    embeddingGeneratedAt: Date,
    vectorId: String,

    // RAG metrics
    usedAsContext: {
        type: Number,
        default: 0
    },
    contextRelevanceScore: Number

}, { timestamps: true });

// Indexes for efficient queries
findingSchema.index({ severity: 1, fixApplied: 1 });
findingSchema.index({ embeddingGenerated: 1 });
findingSchema.index({ createdAt: -1 });

// Prevent overwriting model if already compiled
const Finding = mongoose.models.Finding || mongoose.model('Finding', findingSchema);

module.exports = Finding;
