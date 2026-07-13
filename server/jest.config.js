export default {
  testEnvironment: "node",

  // ESM support — required because the codebase uses `"type": "module"`.
  transform: {},

  // Shared DB lifecycle hooks run before every test file.
  setupFilesAfterEnv: ["./tests/setup.js"],

  // 30 s per test keeps CI green on slow Windows machines where the
  // MongoMemoryServer binary launch and first connection can take >5 s.
  testTimeout: 30000,
};
