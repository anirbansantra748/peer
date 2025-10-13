const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('../utils/prettyLogger');

// Prefer REDIS_URL if provided; otherwise, use host/port.
const redisUrl = process.env.REDIS_URL;
let connection;
if (redisUrl) {
  // BullMQ requires maxRetriesPerRequest to be null for blocking connections used by Workers.
  connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
} else {
  connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null,
  });
}

// Create analyze queue
const analyzeQueue = new Queue('analyze', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

// Create autofix queue
const autofixQueue = new Queue('autofix', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: 'fixed', delay: 3000 },
  },
});

analyzeQueue.on('error', (error) => {
  logger.error('queue', 'Analyze queue error', { error: String(error) });
});

autofixQueue.on('error', (error) => {
  logger.error('queue', 'Autofix queue error', { error: String(error) });
});

connection.on('connect', () => {
  logger.info('queue', 'Connected to Redis', { url: redisUrl || `${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}` });
});

connection.on('error', (error) => {
  logger.error('queue', 'Redis connection error', { error: String(error) });
});

module.exports = { connection, analyzeQueue, autofixQueue, Worker };

