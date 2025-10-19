require('dotenv').config();
const mongoose = require('mongoose');
const { Worker, connection } = require('../../shared/queue');
const PRRun = require('../../shared/models/PRRun');
const Installation = require('../../shared/models/Installation');
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

      // Load installation config if available
      let installationConfig = null;
      if (prRun.installationId) {
        const installation = await Installation.findById(prRun.installationId);
        if (installation) {
          installationConfig = installation.config;
          logger.info('analyzer', 'Installation config loaded', {
            runId,
            mode: installationConfig.mode,
            severities: installationConfig.severities,
            maxFilesPerRun: installationConfig.maxFilesPerRun
          });
        }
      }

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

      // Filter findings by installation severity config if available
      let filteredFindings = finalFindings;
      if (installationConfig && installationConfig.severities.length > 0) {
        const allowedSeverities = new Set(installationConfig.severities);
        filteredFindings = finalFindings.filter(f => allowedSeverities.has(f.severity));
        logger.info('analyzer', 'Findings filtered by severity', {
          runId,
          beforeFilter: finalFindings.length,
          afterFilter: filteredFindings.length,
          allowedSeverities: installationConfig.severities
        });
      }

      // Persist findings and summary
      prRun.findings.push(...filteredFindings);
      prRun.summary = summary;
      prRun.status = 'completed';
      await prRun.save();

      logger.info('analyzer', 'Run completed', { runId, summary: prRun.summary, findings: prRun.findings.length });
      
      console.log('\n========================================');
      console.log('✅ ANALYSIS COMPLETED');
      console.log('========================================');
      console.log(`📦 Repository: ${repo}`);
      console.log(`🔢 PR Number: #${prNumber}`);
      console.log(`🔍 Issues Found: ${prRun.findings.length}`);
      console.log(`🔴 Critical: ${prRun.findings.filter(f => f.severity === 'critical').length}`);
      console.log(`🟠 High: ${prRun.findings.filter(f => f.severity === 'high').length}`);
      console.log(`🟡 Medium: ${prRun.findings.filter(f => f.severity === 'medium').length}`);
      console.log(`⚪ Low: ${prRun.findings.filter(f => f.severity === 'low').length}`);
      if (installationConfig && (installationConfig.mode === 'commit' || installationConfig.mode === 'merge')) {
        console.log(`🤖 Auto-fix will start next...`);
      }
      console.log('========================================\n');

      // Auto-trigger autofix if mode is 'commit' or 'merge' (skip for 'review' mode)
      if (installationConfig && (installationConfig.mode === 'commit' || installationConfig.mode === 'merge')) {
        // Get all finding IDs to auto-fix
        const findingIds = prRun.findings.map(f => String(f._id));
        
        // Only trigger if there are findings
        if (findingIds.length > 0) {
          logger.info('analyzer', 'Auto-triggering autofix', { 
            runId, 
            mode: installationConfig.mode,
            findingsCount: findingIds.length 
          });
        } else {
          logger.info('analyzer', 'No findings to fix, skipping autofix', { runId });
        }
        
        if (findingIds.length > 0) {
          // Import autofix queue
          const { autofixQueue } = require('../../shared/queue');
          // Create preview first (automatically creates PatchRequest)
          const PatchRequest = require('../../shared/models/PatchRequest');
          
          // Get userId from installation if available
          const installation = prRun.installationId ? await Installation.findById(prRun.installationId) : null;
          const userId = installation?.userId || null;
          
          const patch = new PatchRequest({
            runId,
            repo: prRun.repo,
            prNumber: prRun.prNumber,
            sha: prRun.sha,
            selectedFindingIds: findingIds,
            userId, // Add user context for token tracking
            status: 'queued',
            preview: { unifiedDiff: '', files: [], filesExpected: 0 },
          });
          await patch.save();
          
          logger.info('analyzer', 'PatchRequest created for auto-fix', { 
            patchRequestId: patch._id.toString(),
            findingsCount: findingIds.length 
          });
          
          // Enqueue preview job
          await autofixQueue.add('preview', { patchRequestId: patch._id.toString() });
          
          logger.info('analyzer', 'Auto-fix preview job enqueued', { 
            patchRequestId: patch._id.toString() 
          });
        }
      }

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
