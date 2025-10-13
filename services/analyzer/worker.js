require('dotenv').config();
const mongoose = require('mongoose');
const { Worker, connection } = require('../../shared/queue');
const PRRun = require('../../shared/models/PRRun');
const logger = require('../../shared/utils/prettyLogger');
const { analyzeRepoDeep } = require('../../shared/analyzers');
const { orchestrate } = require('../../shared/orchestrator');

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/peer')
  .then(() => logger.info('analyzer', 'Connected to MongoDB'))
  .catch((err) => {
    logger.error('analyzer', 'MongoDB connection error', { error: String(err) });
    process.exit(1);
  });

// Create the analyzer worker
const analyzerWorker = new Worker(
  'analyze',
  async (job) => {
    const { runId, repo, prNumber, sha, baseSha } = job.data;

    logger.info('analyzer', 'Job received', { jobId: job.id, runId, repo, prNumber, sha, baseSha });

    // Helper function to retry finding PRRun with exponential backoff
    async function findPRRunWithRetry(id, maxAttempts = 5) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const prRun = await PRRun.findById(id);
        if (prRun) {
          logger.info('analyzer', 'PRRun found', { runId: id, attempt });
          return prRun;
        }
        
        if (attempt < maxAttempts) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
          logger.warn('analyzer', 'PRRun not found, retrying...', { runId: id, attempt, waitMs: waitTime });
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      throw new Error(`PRRun ${id} not found after ${maxAttempts} attempts`);
    }
    
    try {
      // Find the PRRun document with retry logic
      const prRun = await findPRRunWithRetry(runId);

      // Update status to running
      prRun.status = 'running';
      await prRun.save();
      logger.info('analyzer', 'PRRun set to running', { runId });

      // Analyze repository with all 4 analyzers (style, logic, security, improvement)
      const { findings, changed, analyzerResults } = await analyzeRepoDeep({ repo, sha, baseSha });
      logger.info('analyzer', 'Deep analysis complete', {
        runId,
        changedCount: changed.length,
        totalFindings: findings.length,
        byAnalyzer: {
          style: analyzerResults.style?.length || 0,
          logic: analyzerResults.logic?.length || 0,
          security: analyzerResults.security?.length || 0,
          improvement: analyzerResults.improvement?.length || 0,
          html: analyzerResults.html?.length || 0,
          css: analyzerResults.css?.length || 0,
          universal: analyzerResults.universal?.length || 0,
        },
      });

      // Orchestrate (dedupe, rank, summarize)
      const { findings: finalFindings, summary } = orchestrate(findings);

      // Persist findings and summary
      prRun.findings.push(...finalFindings);
      prRun.summary = summary;
      prRun.status = 'completed';
      await prRun.save();

      logger.info('analyzer', 'Run completed', { runId, summary: prRun.summary, findings: prRun.findings.length });

      return { runId, status: 'completed', summary: prRun.summary, findingsCount: prRun.findings.length };
    } catch (error) {
      logger.error('analyzer', 'Job error', { jobId: job.id, runId, error: String(error) });
      try {
        const prRun = await PRRun.findById(runId);
        if (prRun) {
          prRun.status = 'failed';
          await prRun.save();
          logger.info('analyzer', 'Run marked failed', { runId });
        }
      } catch (updateError) {
        logger.error('analyzer', 'Failed to mark run failed', { runId, error: String(updateError) });
      }
      throw error; // mark job as failed
    }
  },
  { connection, concurrency: 2 }
);

// Worker event listeners
analyzerWorker.on('completed', (job, result) => {
  logger.info('analyzer', 'Job completed', { jobId: job.id, runId: result?.runId, findings: result?.findingsCount });
});

analyzerWorker.on('failed', (job, error) => {
  logger.error('analyzer', 'Job failed', { jobId: job?.id, error: String(error?.message || error) });
});

analyzerWorker.on('error', (error) => {
  logger.error('analyzer', 'Worker error', { error: String(error) });
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('analyzer', 'Shutting down gracefully...');
  await analyzerWorker.close();
  await connection.quit();
  await mongoose.connection.close();
  process.exit(0);
});

logger.info('analyzer', 'Worker started, waiting for jobs...');
