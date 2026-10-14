import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dynamicVitestPatterns = [];
try {
  const scanVitestFiles = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "coverage") continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanVitestFiles(fullPath);
      } else if (entry.name.endsWith(".test.js") || entry.name.endsWith(".spec.js")) {
        const content = readFileSync(fullPath, "utf8");
        if (/from\s+['"]vitest['"]/.test(content)) {
          dynamicVitestPatterns.push(entry.name.replace(/\./g, "\\."));
        }
      }
    }
  };
  scanVitestFiles(__dirname);
} catch {
  // ignore
}

export default {
  testEnvironment: "node",

  // ESM support — required because the codebase uses `"type": "module"`.
  transform: {},

  // Shared DB lifecycle hooks run before every test file.
  setupFilesAfterEnv: ["./tests/setup.js"],

  // 30 s per test keeps CI green on slow Windows machines where the
  // MongoMemoryServer binary launch and first connection can take >5 s.
  testTimeout: 30000,

  // Vitest-authored suites must not be collected by Jest. Loading them under
  // Jest pulls in @vitest/expect and throws:
  //   TypeError: Cannot redefine property: Symbol($$jest-matchers-object)
  // Run those suites via `npm run test:unit` instead.
  testPathIgnorePatterns: [
    "/node_modules/",
    "/jobs/__tests__/",
    "/socket/__tests__/",
    "/controllers/__tests__/",
    "/services/__tests__/",
    "/config/__tests__/",
    "\\.vitest\\.test\\.js$",
    "tests/integration\\.test\\.js$",
    "tests/policyComplianceIntegration\\.test\\.js$",
    ...dynamicVitestPatterns,

    "documentSyncAuthorization.test.js",
    "workspaceSocketAuthentication.test.js",
    "topicValidation.test.js",
    "glossarySearchSecurity.test.js",
    "organizationController.test.js",
    "InvitationService.test.js",
    "OrganizationService.test.js",
    "knowledgeController.test.js",
    "transcriptController.test.js",
    "meetingDigestService.test.js",
    "clerkRbacIntegration.test.js",
    "decisionGraphOptimized.test.js",
    "sessionAiPermission.test.js",
    "MeetingService.test.js",
    "attendanceAnalyticsOptimized.test.js",
    "calendarSyncOrganization.test.js",
    "pollExpirationBatch.test.js",
    "realtimeClerkAuthPhase4.test.js",
    "voiceSearchTenantIsolation.test.js",
    "sharedLinkAnalytics.test.js",
    "ragAssistantSocketScope.test.js",
    "dashboardController.test.js",
    "routeRegistration.test.js",
    "knowledgeSearchRegexSafety.test.js",
    "periodBucket.test.js",
    "rateLimitStore.test.js",
    "attachmentDownloadHeaders.test.js",
    "vectorSearchOrgFiltering.test.js",
    "vectorMetadataMinimization.test.js",
    "translationSocketAuth.test.js",
    "publicOrgDiscovery.test.js",
    "rateLimiter.test.js",
    "pollExpirationJob.test.js",
    "originValidation.test.js",
    "meetingQualityWiring.test.js",
    "meetingPresenceSpoofing.test.js",
    "liveMeetingInvitationValidation.test.js",
    "corsOptions.test.js",
    "bookmarkOrphanedSafety.test.js",
    "bookmarkOwnership.test.js",
    "archivedKnowledgeService.test.js",
    "aiMomWorkerRegistration.test.js",
    "agendaPacingAuthorization.test.js",
    "followUpReminderJobRegistration.test.js",
    "automationRulesRbac.test.js",
    "calendarConnectionSync.test.js",
    "clerkUserProvisioningRace.test.js",
    "reactionSocketAuthorization.test.js",
    "translationAuthorization.test.js",
    "policyComplianceRoutePrefix.test.js",
    "knowledgeGraphRouteMount.test.js",
    "icebreaker.test.js",
  ],
};
