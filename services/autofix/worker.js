require('dotenv').config();
const mongoose = require('mongoose');
const { Worker, connection } = require('../../shared/queue');
const logger = require('../../shared/utils/prettyLogger');
const PatchRequest = require('../../shared/models/PatchRequest');
const { buildPreview, applyPatch } = require('../../shared/autofix/engine');

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