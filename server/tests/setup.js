import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// ─── Why top-level await? ──────────────────────────────────────────────────
// setupFilesAfterEnv modules are evaluated *before* the test file's own
// import graph is resolved.  server.js contains a top-level
// `await connectDB()`, so TEST_MONGODB_URI must be set before that module
// is even loaded.  Moving this into a beforeAll() would be too late.
// ──────────────────────────────────────────────────────────────────────────
const mongoServer = await MongoMemoryServer.create();
const uri = mongoServer.getUri();

process.env.TEST_MONGODB_URI = uri.replace(/\/$/, "");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

// ─── Teardown ──────────────────────────────────────────────────────────────
afterAll(async () => {
  // Disconnect gracefully; swallow the error if mongoose never connected
  // (e.g. pure-logic test suites that don't import server.js).
  await mongoose.disconnect().catch(() => {});
  await mongoServer.stop();
});

// ─── Per-test DB wipe ─────────────────────────────────────────────────────
afterEach(async () => {
  // Guard: pure unit-test suites (e.g. policyComplianceService.test.js)
  // never open a DB connection — mongoose.connection.readyState will be 0
  // (disconnected).  Attempting collection operations on a closed connection
  // hangs for ~5 s per test, so we short-circuit here.
  if (mongoose.connection.readyState !== 1 /* CONNECTED */) return;

  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})),
  );
});
