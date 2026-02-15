require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Worker, connection } = require('../../shared/queue');
const logger = require('../../shared/utils/prettyLogger');
const PatchRequest = require('../../shared/models/PatchRequest');
const { buildPreview, applyPatch } = require('../../shared/autofix/engine');
process.env.LLM_STRATEGY='full';

// Create HTTP server for health checks (required for Render web service)
const app = express();
const PORT = process.env.PORT || 3003;

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'autofix', status: 'running' });
});

app.listen(PORT, () => {
  logger.info('autofix', `Health check server listening on port ${PORT}`);
});


// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/peer')
  .then(() => logger.info('autofix', 'Connected to MongoDB'))
  .catch((err) => {
    logger.error('autofix', 'MongoDB connection error', { error: String(err) });
    process.exit(1);
  });

const autofixWorker = new Worker(
  'autofix',
  async (job) => {
    const { name } = job;
    const { patchRequestId } = job.data || {};
    if (!patchRequestId) throw new Error('patchRequestId is required');

    logger.info('autofix', 'Job received', { jobId: job.id, type: name, patchRequestId });

    if (name === 'preview') {
      const patch = await buildPreview(patchRequestId);
      logger.info('autofix', 'Preview built', { patchRequestId, status: patch.status, bytes: (patch.preview?.unifiedDiff || '').length });

      // Auto-trigger apply if mode is commit/merge
      if (patch.status === 'preview_ready') {
        const PRRun = require('../../shared/models/PRRun');
        const Installation = require('../../shared/models/Installation');
        const { autofixQueue } = require('../../shared/queue');

        try {
          const run = await PRRun.findById(patch.runId);
          if (run && run.installationId) {
            const installation = await Installation.findById(run.installationId);

            if (installation && (installation.config.mode === 'commit' || installation.config.mode === 'merge')) {
              logger.info('autofix', 'Auto-triggering apply job', {
                patchRequestId,
                mode: installation.config.mode
              });

              // Enqueue apply job
              await autofixQueue.add('apply', { patchRequestId });

              logger.info('autofix', 'Apply job enqueued', { patchRequestId });
            }
          }
        } catch (error) {
          logger.error('autofix', 'Failed to auto-trigger apply', {
            patchRequestId,
            error: String(error)
          });
        }
      }

      return { patchRequestId, status: patch.status };
    }

    if (name === 'preview_file') {
      const { buildPreviewForSingleFile } = require('../../shared/autofix/engine');
      const { file } = job.data || {};
      if (!file) throw new Error('file is required');
      const patch = await buildPreviewForSingleFile(patchRequestId, file);
      logger.info('autofix', 'File preview built', { patchRequestId, file, status: patch.status });
      return { patchRequestId, file, status: patch.status };
    }

    if (name === 'apply') {
      const patch = await applyPatch(patchRequestId);
      logger.info('autofix', 'Apply completed', { patchRequestId, status: patch.status, applied: patch.results?.applied?.length });
      
      // Send notification after apply completes
      try {
        const PRRun = require('../../shared/models/PRRun');
        const Installation = require('../../shared/models/Installation');
        const notificationHelper = require('../../shared/utils/notificationHelper');
        
        const run = await PRRun.findById(patch.runId);
        if (run && run.installationId) {
          const installation = await Installation.findById(run.installationId);
          
          if (installation && installation.userId) {
            const fixedCount = patch.results?.applied?.length || 0;
            const fixPrNumber = patch.results?.fixPrNumber;
            const fixPrUrl = patch.results?.fixPrUrl;
            const autoMerged = patch.results?.autoMerged;
            
            // Determine which notification to send based on mode and merge status
            if (installation.config.mode === 'merge' && autoMerged) {
              // Mode 0: Auto-merge complete
              await notificationHelper.notifyAutoMergeComplete({
                userId: installation.userId,
                repo: patch.repo,
                prNumber: patch.prNumber,
                runId: patch.runId,
                fixedCount,
                fixPrNumber,
                fixPrUrl
              });
              logger.info('autofix', 'Auto-merge complete notification sent', { patchRequestId });
            } else if (installation.config.mode === 'commit' || (installation.config.mode === 'merge' && !autoMerged)) {
              // Mode 1: Approval needed
              await notificationHelper.notifyApprovalNeeded({
                userId: installation.userId,
                repo: patch.repo,
                prNumber: patch.prNumber,
                runId: patch.runId,
                fixedCount,
                fixPrNumber,
                fixPrUrl
              });
              logger.info('autofix', 'Approval needed notification sent', { patchRequestId });
            }
          }
        }
      } catch (notifError) {
        logger.warn('autofix', 'Failed to send notification', { patchRequestId, error: String(notifError) });
      }
      
      return { patchRequestId, status: patch.status };
    }

    throw new Error(`Unknown job name: ${name}`);
  },
  { connection, concurrency: 2 }
);

autofixWorker.on('completed', (job, result) => {
  logger.info('autofix', 'Job completed', { jobId: job.id, result });
});

autofixWorker.on('failed', (job, error) => {
  logger.error('autofix', 'Job failed', { jobId: job?.id, error: String(error?.message || error) });
});

autofixWorker.on('error', (error) => {
  logger.error('autofix', 'Worker error', { error: String(error) });
});

process.on('SIGINT', async () => {
  logger.info('autofix', 'Shutting down gracefully...');
  await autofixWorker.close();
  await connection.quit();
  await mongoose.connection.close();
  process.exit(0);
});

logger.info('autofix', 'Worker started, waiting for jobs...');
