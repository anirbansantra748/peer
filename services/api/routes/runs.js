const express = require('express');
const PRRun = require('../../../shared/models/PRRun');
const PatchRequest = require('../../../shared/models/PatchRequest');
const { autofixQueue } = require('../../../shared/queue');
const logger = require('../../../shared/utils/prettyLogger');

const router = express.Router();

/**
 * GET /api/runs/:runId
 * Get PR run details with all findings
 */
router.get('/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    
    const prRun = await PRRun.findById(runId);
    if (!prRun) {
      return res.status(404).json({ error: 'PR run not found' });
    }
    
    res.json({
      ok: true,
      run: {
        _id: prRun._id,
        repo: prRun.repo,
        prNumber: prRun.prNumber,
        sha: prRun.sha,
        status: prRun.status,
        summary: prRun.summary,
        findings: prRun.findings,
        createdAt: prRun.createdAt,
      },
    });
  } catch (error) {
    logger.error('api', 'Error fetching run', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

/**
 * POST /api/runs/:runId/create-patch
 * Create a patch request with selected findings
 * Body: { findingIds: string[] }
 */
router.post('/:runId/create-patch', async (req, res) => {
  try {
    const { runId } = req.params;
    const { findingIds } = req.body;
    
    if (!Array.isArray(findingIds) || findingIds.length === 0) {
      return res.status(400).json({ error: 'findingIds must be a non-empty array' });
    }
    
    const prRun = await PRRun.findById(runId);
    if (!prRun) {
      return res.status(404).json({ error: 'PR run not found' });
    }
    
    // Validate all finding IDs exist
    const validFindingIds = prRun.findings
      .filter(f => findingIds.includes(String(f._id)))
      .map(f => String(f._id));
    
    if (validFindingIds.length === 0) {
      return res.status(400).json({ error: 'No valid findings selected' });
    }
    
    // Create PatchRequest
    const patch = new PatchRequest({
      runId,
      repo: prRun.repo,
      prNumber: prRun.prNumber,
      sha: prRun.sha,
      selectedFindingIds: validFindingIds,
      status: 'queued',
      preview: { unifiedDiff: '', files: [], filesExpected: 0 },
    });
    await patch.save();
    
    logger.info('api', 'Manual patch request created', {
      patchRequestId: patch._id.toString(),
      runId,
      findingsCount: validFindingIds.length,
    });
    
    // Enqueue preview job
    await autofixQueue.add('preview', { patchRequestId: patch._id.toString() });
    
    logger.info('api', 'Manual patch preview job enqueued', {
      patchRequestId: patch._id.toString(),
    });
    
    res.json({
      ok: true,
      patchRequestId: patch._id.toString(),
      findingsCount: validFindingIds.length,
    });
  } catch (error) {
    logger.error('api', 'Error creating patch', { error: String(error), stack: error.stack });
    res.status(500).json({ error: 'Failed to create patch request' });
  }
});

module.exports = router;
