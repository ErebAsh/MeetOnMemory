import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import processAudioJob from "../jobs/processAudioJob.js";
import exportDataJob from "../jobs/exportDataJob.js";

const redisUri = process.env.REDIS_URI;

// BullMQ requires maxRetriesPerRequest to be null
let _producerConnection = null;
let _workerConnection = null;
let _aiQueueInstance = null;
let _dataExportQueueInstance = null;

function getProducerConnection() {
  if (!redisUri) return null;
  if (!_producerConnection) {
    _producerConnection = new Redis(redisUri, {
      maxRetriesPerRequest: 3, // Fail fast for requests adding tasks to queue
      family: 0,
    });
    _producerConnection.on("error", (err) => {
      console.error("⚠️ BullMQ Producer Redis Connection Error:", err.message);
    });
  }
  return _producerConnection;
}

function getWorkerConnection() {
  if (!redisUri) return null;
  if (!_workerConnection) {
    _workerConnection = new Redis(redisUri, {
      maxRetriesPerRequest: null, // Unlimited retries for background workers
      family: 0, // Helps with DNS resolution for some cloud providers
    });
    _workerConnection.on("error", (err) => {
      console.error("⚠️ BullMQ Worker Redis Connection Error:", err.message);
    });
  }
  return _workerConnection;
}

function getAiQueue() {
  if (!redisUri) return null;
  if (!_aiQueueInstance) {
    const conn = getProducerConnection();
    if (conn) {
      _aiQueueInstance = new Queue("ai-mom-generation", { connection: conn });
    }
  }
  return _aiQueueInstance;
}

function getDataExportQueue() {
  if (!redisUri) return null;
  if (!_dataExportQueueInstance) {
    const conn = getProducerConnection();
    if (conn) {
      _dataExportQueueInstance = new Queue("data-export-queue", { connection: conn });
    }
  }
  return _dataExportQueueInstance;
}

// Wrapper to preserve syntax compatibility
export const aiQueue = {
  add: async (...args) => {
    const q = getAiQueue();
    if (!q) {
      console.warn("⚠️ Queue operation ignored: Redis is not configured.");
      return null;
    }
    return await q.add(...args);
  },
  get isActive() {
    return getAiQueue() !== null;
  }
};

export const dataExportQueue = {
  add: async (...args) => {
    const q = getDataExportQueue();
    if (!q) {
      console.warn("⚠️ Queue operation ignored: Redis is not configured.");
      return null;
    }
    return await q.add(...args);
  },
  get isActive() {
    return getDataExportQueue() !== null;
  }
};

export const initAIWorker = (app) => {
  const connection = getWorkerConnection();
  if (!connection) {
    console.warn("⚠️ Redis not configured. AI Worker will not start.");
    return;
  }

  const worker = new Worker(
    "ai-mom-generation",
    async (job) => await processAudioJob(job, app),
    { connection, concurrency: 5 }, // Handle up to 5 concurrent jobs
  );

  worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Job ${job.id} failed with error:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("❌ AI Worker error:", err.message);
  });

  console.log(
    "✅ AI Worker initialized and listening to ai-mom-generation queue",
  );
};

export const initDataExportWorker = (app) => {
  const connection = getWorkerConnection();
  if (!connection) {
    console.warn("⚠️ Redis not configured. Data Export Worker will not start.");
    return;
  }

  const worker = new Worker(
    "data-export-queue",
    async (job) => await exportDataJob(job, app),
    { connection, concurrency: 2 }
  );

  worker.on("completed", (job) => {
    console.log(`✅ Data Export Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Data Export Job ${job.id} failed with error:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("❌ Data Export Worker error:", err.message);
  });

  console.log("✅ Data Export Worker initialized and listening to data-export-queue");
};