import {
  getChangedFiles,
  logStep,
  quoteFiles,
  repoRoot,
  run,
  runNpx,
} from "./changed-files.mjs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const JEST =
  "node --max-old-space-size=8192 --experimental-vm-modules node_modules/jest/bin/jest.js --forceExit";
const serverCwd = `${repoRoot}/server`;

const TEST_FILE_REGEX = /(\.test\.|\.spec\.|__tests__)/;
const VITEST_TEST_FILES = new Set([
  "server/tests/OrganizationService.test.js",
  "server/tests/InvitationService.test.js",
  "server/tests/organizationController.test.js",
  "server/tests/knowledgeController.test.js",
  "server/tests/transcriptController.test.js",
  "server/tests/meetingDigestService.test.js",
  "server/tests/imageUrl.test.js",
  "server/tests/MeetingService.test.js",
  "server/tests/realtimeClerkAuthPhase4.test.js",
  "server/tests/sharedLinkAnalytics.test.js",
  "server/tests/meetingValidation.test.js",
  "server/tests/e2eeFeatureFlag.test.js",
  "server/tests/sessionController.test.js",
  "server/tests/meetingROIController.test.js",
  "server/tests/aiMeetingNoteController.test.js",
  "server/__tests__/audit.test.js",
  "server/tests/documentSyncAuthorization.test.js",
  "server/tests/workspaceSocketAuthentication.test.js",
  "server/tests/topicValidation.test.js",
  "server/tests/glossarySearchSecurity.test.js",
  "server/tests/clerkRbacIntegration.test.js",
  "server/tests/decisionGraphOptimized.test.js",
  "server/tests/sessionAiPermission.test.js",
  "server/tests/attendanceAnalyticsOptimized.test.js",
  "server/tests/calendarSyncOrganization.test.js",
  "server/tests/pollExpirationBatch.test.js",
  "server/tests/voiceSearchTenantIsolation.test.js",
  "server/tests/ragAssistantSocketScope.test.js",
  "server/tests/dashboardController.test.js",
  "server/tests/routeRegistration.test.js",
  "server/tests/knowledgeSearchRegexSafety.test.js",
  "server/tests/periodBucket.test.js",
  "server/tests/rateLimitStore.test.js",
  "server/tests/attachmentDownloadHeaders.test.js",
  "server/tests/vectorSearchOrgFiltering.test.js",
  "server/tests/vectorMetadataMinimization.test.js",
  "server/tests/translationSocketAuth.test.js",
  "server/tests/publicOrgDiscovery.test.js",
  "server/tests/rateLimiter.test.js",
  "server/tests/pollExpirationJob.test.js",
  "server/tests/originValidation.test.js",
  "server/tests/meetingQualityWiring.test.js",
  "server/tests/meetingPresenceSpoofing.test.js",
  "server/tests/liveMeetingInvitationValidation.test.js",
  "server/tests/corsOptions.test.js",
  "server/tests/bookmarkOrphanedSafety.test.js",
  "server/tests/bookmarkOwnership.test.js",
  "server/tests/archivedKnowledgeService.test.js",
  "server/tests/aiMomWorkerRegistration.test.js",
  "server/tests/agendaPacingAuthorization.test.js",
  "server/tests/followUpReminderJobRegistration.test.js",
  "server/tests/automationRulesRbac.test.js",
  "server/tests/calendarConnectionSync.test.js",
  "server/tests/clerkUserProvisioningRace.test.js",
  "server/tests/reactionSocketAuthorization.test.js",
  "server/tests/translationAuthorization.test.js",
  "server/tests/policyComplianceRoutePrefix.test.js",
  "server/tests/knowledgeGraphRouteMount.test.js",
  "server/tests/icebreaker.test.js",
  "server/tests/analyticsRouteWiring.test.js",
  "server/jobs/__tests__/actionItemReminderJobRegistration.test.js",
]);
const JEST_RELATED_IGNORE = [
  "tests/integration.test.js",
  "tests/policyComplianceIntegration.test.js",
];

const fileExists = (repoRelativePath) =>
  existsSync(path.join(repoRoot, repoRelativePath));

const changedFiles = getChangedFiles();
const serverFiles = changedFiles.filter(
  (file) =>
    file.startsWith("server/") &&
    /\.(js|jsx|ts|tsx)$/.test(file) &&
    !file.includes("/coverage/"),
);

const directTests = serverFiles.filter((file) => TEST_FILE_REGEX.test(file));
const sourceFiles = serverFiles.filter((file) => !directTests.includes(file));
const vitestOwnedSources = new Set([
  "server/services/OrganizationService.js",
  "server/services/InvitationService.js",
  "server/controllers/organizationController.js",
  "server/controllers/knowledgeController.js",
  "server/controllers/transcriptController.js",
  "server/models/transcriptModel.js",
  "server/routes/transcriptRoutes.js",
  "server/routes/meetingRoutes.js",
  "server/models/meetingModel.js",
  "server/middleware/meetingValidation.js",
  "server/controllers/meetingSeriesController.js",
  "server/controllers/meetingController.js",
  "server/controllers/sessionController.js",
  "server/models/sessionCardModel.js",
  "server/routes/sessionRoutes.js",
  "server/controllers/sharedLinkController.js",
  "server/models/sharedLinkModel.js",
  "server/config/express.js",
  "server/services/meetingDigestService.js",
  "server/services/MeetingService.js",
  "server/services/MeetingStorageService.js",
  "server/utils/imageUrl.js",
  "server/models/organizationModel.js",
  "server/utils/transcriptEncryption.js",
  "server/controllers/meetingROIController.js",
  "server/models/meetingROIModel.js",
  "server/routes/meetingROIRoutes.js",
  "server/controllers/aiMeetingNoteController.js",
  "server/models/aiMeetingNoteModel.js",
  "server/routes/aiMeetingNoteRoutes.js",
  "server/controllers/breakoutRoomController.js",
  "server/routes/breakoutRoomRoutes.js",
  "server/services/breakoutRoomService.js",
  "server/models/breakoutRoomModel.js",
  "server/models/BreakoutRoom.js",
  "server/socket/meetingSocket.js",
  "server/controllers/guestAccessController.js",
  "server/routes/guestAccessRoutes.js",
  "server/services/guestAccessService.js",
  "server/models/guestAccessTokenModel.js",
  "server/models/guestFeedbackModel.js",
  "server/models/GuestFeedback.js",
  "server/models/GuestToken.js",
  "server/controllers/resourceBookingController.js",
  "server/routes/resourceBookingRoutes.js",
  "server/services/resourceBookingService.js",
  "server/models/resourceBookingModel.js",
  "server/models/physicalResourceModel.js",
  "server/middleware/authMiddleware.js",
  "server/controllers/keyMomentController.js",
  "server/routes/keyMomentRoutes.js",
  "server/routes/auditRoutes.js",
  "server/controllers/standupController.js",
  "server/routes/standupRoutes.js",
  "server/controllers/decisionLogController.js",
  "server/routes/decisionLogRoutes.js",
  "server/services/decisionLogService.js",
  "server/controllers/preMeetingBriefingController.js",
  "server/routes/preMeetingBriefingRoutes.js",
  "server/routes/index.js",
]);
const VITEST_SOURCE_TEST_MAP = {
  "server/controllers/decisionLogController.js":
    "server/tests/decisionLogAnalytics.vitest.test.js",
  "server/routes/decisionLogRoutes.js":
    "server/tests/decisionLogAnalytics.vitest.test.js",
  "server/services/decisionLogService.js":
    "server/tests/decisionLogAnalytics.vitest.test.js",
  "server/controllers/preMeetingBriefingController.js":
    "server/tests/preMeetingBriefingController.vitest.test.js",
  "server/routes/preMeetingBriefingRoutes.js":
    "server/tests/preMeetingBriefingController.vitest.test.js",
  "server/routes/auditRoutes.js": "server/__tests__/audit.test.js",
  "server/controllers/standupController.js":
    "server/tests/standupController.vitest.test.js",
  "server/routes/standupRoutes.js":
    "server/tests/standupController.vitest.test.js",
  "server/controllers/breakoutRoomController.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/routes/breakoutRoomRoutes.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/services/breakoutRoomService.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/models/breakoutRoomModel.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/models/BreakoutRoom.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/socket/meetingSocket.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/controllers/guestAccessController.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/routes/guestAccessRoutes.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/services/guestAccessService.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/models/guestAccessTokenModel.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/models/guestFeedbackModel.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/models/GuestFeedback.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/models/GuestToken.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/controllers/resourceBookingController.js":
    "server/tests/resourceBookingController.vitest.test.js",
  "server/routes/resourceBookingRoutes.js":
    "server/tests/resourceBookingController.vitest.test.js",
  "server/services/resourceBookingService.js":
    "server/tests/resourceBookingController.vitest.test.js",
  "server/models/resourceBookingModel.js":
    "server/tests/resourceBookingController.vitest.test.js",
  "server/models/physicalResourceModel.js":
    "server/tests/resourceBookingController.vitest.test.js",
  "server/controllers/keyMomentController.js":
    "server/tests/keyMomentController.vitest.test.js",
  "server/routes/keyMomentRoutes.js":
    "server/tests/keyMomentController.vitest.test.js",
  "server/models/organizationModel.js":
    "server/tests/OrganizationService.test.js",
  "server/utils/transcriptEncryption.js":
    "server/tests/e2eeFeatureFlag.test.js",
  "server/controllers/meetingROIController.js":
    "server/tests/meetingROIController.test.js",
  "server/models/meetingROIModel.js":
    "server/tests/meetingROIController.test.js",
  "server/routes/meetingROIRoutes.js":
    "server/tests/meetingROIController.test.js",
  "server/controllers/aiMeetingNoteController.js":
    "server/tests/aiMeetingNoteController.test.js",
  "server/models/aiMeetingNoteModel.js":
    "server/tests/aiMeetingNoteController.test.js",
  "server/routes/aiMeetingNoteRoutes.js":
    "server/tests/aiMeetingNoteController.test.js",
  "server/controllers/transcriptController.js":
    "server/tests/transcriptController.test.js",
  "server/models/transcriptModel.js":
    "server/tests/transcriptController.test.js",
  "server/routes/transcriptRoutes.js":
    "server/tests/transcriptController.test.js",
  "server/routes/meetingRoutes.js": "server/tests/transcriptController.test.js",
  "server/models/meetingModel.js": "server/tests/meetingValidation.test.js",
  "server/middleware/meetingValidation.js":
    "server/tests/meetingValidation.test.js",
  "server/controllers/meetingSeriesController.js":
    "server/tests/meetingValidation.test.js",
  "server/controllers/sessionController.js":
    "server/tests/sessionController.test.js",
  "server/models/sessionCardModel.js": "server/tests/sessionController.test.js",
  "server/routes/sessionRoutes.js": "server/tests/sessionController.test.js",
  "server/controllers/meetingController.js":
    "server/tests/MeetingService.test.js",
  "server/services/MeetingService.js": "server/tests/MeetingService.test.js",
  "server/services/MeetingStorageService.js":
    "server/tests/MeetingService.test.js",
  "server/controllers/sharedLinkController.js":
    "server/tests/sharedLinkAnalytics.test.js",
  "server/models/sharedLinkModel.js":
    "server/tests/sharedLinkAnalytics.test.js",
  "server/config/express.js": "server/tests/sharedLinkAnalytics.test.js",
};
// Suites named `*.vitest.test.js` are Vitest-owned by convention and need no
// entry in VITEST_TEST_FILES above (Issue #2575).
const isVitestSuite = (file) => {
  if (VITEST_TEST_FILES.has(file) || file.endsWith(".vitest.test.js"))
    return true;
  const absPath = path.isAbsolute(file) ? file : path.join(repoRoot, file);
  if (!existsSync(absPath)) return false;
  try {
    const content = readFileSync(absPath, "utf8");
    return /from\s+['"]vitest['"]/.test(content);
  } catch {
    return false;
  }
};

const vitestTests = [
  ...directTests.filter(isVitestSuite),
  ...sourceFiles
    .filter((file) => vitestOwnedSources.has(file))
    .map((file) => {
      if (VITEST_SOURCE_TEST_MAP[file]) return VITEST_SOURCE_TEST_MAP[file];
      const base = file.split("/").pop().replace(/\.js$/, "");
      return `server/tests/${base}.test.js`;
    })
    .filter(isVitestSuite),
].filter(fileExists);
const uniqueVitestTests = [...new Set(vitestTests)];
// Skip deleted legacy test files still present in the diff against main.
const jestTests = directTests.filter(
  (file) => !isVitestSuite(file) && fileExists(file),
);
const jestSources = sourceFiles.filter(
  (file) => !vitestOwnedSources.has(file) && fileExists(file),
);

logStep(
  "test:server:related",
  `Running focused server tests for ${serverFiles.length} changed file(s)...`,
);

if (serverFiles.length === 0) {
  logStep("test:server:related", "No changed server files require tests.");
  process.exit(0);
}

if (jestTests.length > 0) {
  run(
    `${JEST} --runInBand --passWithNoTests ${quoteFiles(
      jestTests.map((file) => file.slice("server/".length)),
    )}`,
    {
      cwd: serverCwd,
    },
  );
}

if (jestSources.length > 0) {
  const JEST_GLOBAL_SOURCES = new Set([
    "server/config/mongodb.js",
    "server/config/workers.js",
    "server/tests/setup.js",
    "server/middleware/cacheMiddleware.js",
    "server/middleware/meetingAuth.js",
    "server/middleware/rateLimitStore.js",
    "server/middleware/validateObjectId.js",
    "server/models/notificationModel.js",
    "server/models/MediaSession.js",
    "server/services/notificationService.js",
    "server/services/queueService.js",
    "server/services/calendarSyncService.js",
    "server/services/dataExtractor.js",
    "server/services/documentGenerator.js",
    "server/services/authLinkingService.js",
    "server/controllers/userController.js",
    "server/jobs/processTranscriptionJob.js",
  ]);

  const scopedSources = jestSources
    .filter((file) => !JEST_GLOBAL_SOURCES.has(file))
    .map((file) => file.slice("server/".length));

  if (scopedSources.length > 0) {
    // File paths must immediately follow --findRelatedTests (Jest 30+).
    run(
      `${JEST} --runInBand --passWithNoTests --findRelatedTests ${quoteFiles(
        scopedSources,
      )}`,
      {
        cwd: serverCwd,
      },
    );

    runNpx(
      `vitest related --run --passWithNoTests ${quoteFiles(scopedSources)}`,
      {
        cwd: serverCwd,
      },
    );
  }
}

if (uniqueVitestTests.length > 0) {
  runNpx(
    `vitest run --passWithNoTests ${quoteFiles(
      uniqueVitestTests.map((file) => file.slice("server/".length)),
    )}`,
    {
      cwd: serverCwd,
    },
  );
}
