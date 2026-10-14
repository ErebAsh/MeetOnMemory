import {
  JS_REGEX,
  getChangedFiles,
  logStep,
  quoteFiles,
  repoRoot,
  runNpx,
} from "./changed-files.mjs";

const changedFiles = getChangedFiles();
const clientFiles = changedFiles.filter(
  (file) =>
    file.startsWith("client/src/") &&
    JS_REGEX.test(file) &&
    !file.includes("/__mocks__/"),
);
const ROOT_CLIENT_MAP = {
  "client/src/main.jsx": "client/src/__tests__/App.test.jsx",
  "client/src/App.jsx": "client/src/__tests__/App.test.jsx",
  "client/src/pages/MeetingDetails.jsx":
    "client/src/pages/__tests__/MeetingDetailsReactionSummary.test.jsx",
  "client/src/pages/meeting-details/TransferOwnershipModal.jsx":
    "client/src/pages/__tests__/MeetingDetailsReactionSummary.test.jsx",
  "client/src/components/MeetingDetails/ContributionSummaryPanel.jsx":
    "client/src/components/MeetingDetails/__tests__/ParticipantContributions.test.jsx",
  "client/src/pages/Careers.jsx":
    "client/src/pages/__tests__/Careers.test.jsx",
  "client/src/pages/DecisionLog.jsx":
    "client/src/pages/__tests__/DecisionLog.test.jsx",
  "client/src/services/decisionLogApi.js":
    "client/src/pages/__tests__/DecisionLog.test.jsx",
  "client/src/services/searchApi.js":
    "client/src/pages/__tests__/DecisionTrackingDashboard.test.jsx",
  "client/src/services/sharedLinkApi.js":
    "client/src/pages/__tests__/DecisionTrackingDashboard.test.jsx",
  "client/src/components/DigestPreferences.jsx":
    "client/src/components/__tests__/DigestPreferencesTimezone.test.jsx",
  "client/src/components/integrations/GitHubConnectPanel.jsx":
    "client/src/pages/__tests__/OrganizationSettingsCustomFields.test.jsx",
  "client/src/components/integrations/NotionConnectPanel.jsx":
    "client/src/pages/__tests__/OrganizationSettingsCustomFields.test.jsx",
  "client/src/components/integrations/SlackConnectPanel.jsx":
    "client/src/pages/__tests__/OrganizationSettingsCustomFields.test.jsx",
  "client/src/components/meeting-details/RetrospectiveBoard.jsx":
    "client/src/pages/__tests__/SeriesRetrospectiveNav.test.jsx",
  "client/src/components/meeting-room/LiveIcebreakerBanner.jsx":
    "client/src/services/__tests__/icebreakerApi.test.js",
  "client/src/components/meetings/MeetingRecorder.jsx":
    "client/src/pages/__tests__/MeetingDetailsReactionSummary.test.jsx",
  "client/src/components/meetings/SeriesEvolutionTimeline.jsx":
    "client/src/components/meeting-details/__tests__/SeriesNavigation.test.jsx",
  "client/src/components/transcripts/SharedTranscript.jsx":
    "client/src/pages/__tests__/PublicSharedView.enriched.test.jsx",
  "client/src/hooks/useAgendaVotes.js":
    "client/src/components/MeetingDetails/__tests__/ParticipantContributions.test.jsx",
  "client/src/hooks/useCollaborativeNote.js":
    "client/src/hooks/__tests__/useCollaborativeNote.test.js",
  "client/src/hooks/useMeetingRetrospective.js":
    "client/src/pages/__tests__/SeriesRetrospectiveNav.test.jsx",
  "client/src/hooks/useMindMap.js":
    "client/src/pages/__tests__/DecisionTrackingDashboard.test.jsx",
  "client/src/hooks/useUploadMeetingApi.js":
    "client/src/pages/__tests__/SessionGallery.test.jsx",
  "client/src/pages/AiSearch.jsx":
    "client/src/pages/__tests__/AiSearch.test.jsx",
  "client/src/pages/MeetingAnalytics.jsx":
    "client/src/pages/__tests__/MeetingDetailsReactionSummary.test.jsx",
  "client/src/pages/OrganizationSettings.jsx":
    "client/src/pages/__tests__/OrganizationSettingsCustomFields.test.jsx",
  "client/src/pages/PublicSharedView.jsx":
    "client/src/pages/__tests__/PublicSharedView.enriched.test.jsx",
  "client/src/pages/Status.jsx":
    "client/src/pages/__tests__/DecisionTrackingDashboard.test.jsx",
  "client/src/services/offlineQueue.js":
    "client/src/services/__tests__/offlineQueue.test.js",
  "client/src/components/OfflineBanner.jsx":
    "client/src/components/__tests__/OfflineBanner.test.jsx",
  "client/src/components/OfflineQueueInspector.jsx":
    "client/src/components/__tests__/OfflineQueueInspector.test.jsx",
  "client/src/components/organization/DangerZone.jsx":
    "client/src/components/organization/__tests__/DangerZone.test.jsx",
  "client/src/services/organizationApi.js":
    "client/src/components/organization/__tests__/DangerZone.test.jsx",
  "client/src/pages/AcceptInvite.jsx":
    "client/src/pages/__tests__/AcceptInvite.test.jsx",
  "client/src/services/index.js":
    "client/src/pages/__tests__/SessionGallery.test.jsx",
  "client/src/services/briefingApi.js":
    "client/src/pages/__tests__/MeetingBriefing.test.jsx",
  "client/src/pages/DecisionTrackingDashboard.jsx":
    "client/src/pages/__tests__/DecisionTrackingDashboard.test.jsx",
  "client/src/services/meetingApi.js":
    "client/src/pages/__tests__/SessionGallery.test.jsx",
  "client/src/services/sessionCardApi.js":
    "client/src/pages/__tests__/SessionGallery.test.jsx",
  "client/src/routes/ProtectedRoutes.jsx":
    "client/src/routes/__tests__/ProtectedRoutes.test.jsx",
  "client/src/components/Navbar.jsx":
    "client/src/pages/__tests__/SessionGallery.test.jsx",
  "client/src/pages/CreateMeeting.jsx":
    "client/src/pages/__tests__/SessionGallery.test.jsx",
  "client/src/pages/CreateMeeting/components/SessionCards/GeneratedSessionCards.jsx":
    "client/src/pages/__tests__/SessionGallery.test.jsx",
  "client/src/pages/CreateMeeting/components/SessionCards/SessionCards.jsx":
    "client/src/pages/__tests__/SessionGallery.test.jsx",
  "client/src/pages/CreateMeeting/hooks/useSessionCards.js":
    "client/src/pages/CreateMeeting/hooks/__tests__/useSessionCards.persistence.test.jsx",
  "client/src/pages/SessionGallery.jsx":
    "client/src/pages/__tests__/SessionGallery.test.jsx",
  "client/src/pages/MeetingROIDashboard.jsx":
    "client/src/pages/__tests__/MeetingROIDashboard.test.jsx",
  "client/src/services/meetingROIApi.js":
    "client/src/pages/__tests__/MeetingROIDashboard.test.jsx",
  "client/src/pages/AiMeetingNotesDashboard.jsx":
    "client/src/pages/__tests__/AiMeetingNotesDashboard.test.jsx",
  "client/src/services/aiMeetingNoteApi.js":
    "client/src/pages/__tests__/AiMeetingNotesDashboard.test.jsx",
  "client/src/components/meeting-room/BreakoutRoomPanel.jsx":
    "client/src/components/meeting-room/__tests__/BreakoutRoomPanel.test.jsx",
  "client/src/components/meetings/BreakoutRoomPanel.jsx":
    "client/src/components/meeting-room/__tests__/BreakoutRoomPanel.test.jsx",
  "client/src/services/breakoutRoomApi.js":
    "client/src/components/meeting-room/__tests__/BreakoutRoomPanel.test.jsx",
  "client/src/api/breakoutRoomApi.js":
    "client/src/components/meeting-room/__tests__/BreakoutRoomPanel.test.jsx",

  "client/src/components/meetings/GuestAccessManager.jsx":
    "client/src/components/meetings/__tests__/GuestAccessManager.test.jsx",
  "client/src/pages/GuestJoin.jsx":
    "client/src/components/meetings/__tests__/GuestAccessManager.test.jsx",
  "client/src/pages/GuestMeetingView.jsx":
    "client/src/components/meetings/__tests__/GuestAccessManager.test.jsx",
  "client/src/services/guestAccessApi.js":
    "client/src/components/meetings/__tests__/GuestAccessManager.test.jsx",
  "client/src/config/backendConfig.js":
    "client/src/config/__tests__/backendConfig.test.js",
  "client/src/pages/MeetingBriefing.jsx":
    "client/src/pages/__tests__/MeetingBriefing.test.jsx",
  "client/src/services/briefingApi.js":
    "client/src/pages/__tests__/MeetingBriefing.test.jsx",

  "client/src/components/dashboard/RecurringActionItems.jsx":
    "client/src/components/dashboard/__tests__/RecurringActionItems.test.jsx",
  "client/src/hooks/useRecurringActionItems.js":
    "client/src/hooks/__tests__/useRecurringActionItems.test.jsx",
  "client/src/api/recurringActionItemApi.js":
    "client/src/hooks/__tests__/useRecurringActionItems.test.jsx",
  "client/src/components/common/RecurrencePatternBuilder.jsx":
    "client/src/components/dashboard/__tests__/RecurringActionItems.test.jsx",
  "client/src/pages/Dashboard.jsx":
    "client/src/pages/__tests__/Dashboard.test.jsx",
  "client/src/pages/Tasks.jsx":
    "client/src/pages/__tests__/TasksProfileI18n.test.jsx",
  "client/src/config/backendConfig.js":
    "client/src/config/__tests__/backendConfig.test.js",
};

const directTests = [
  ...new Set([
    ...clientFiles.filter((file) => /(\.test\.|\.spec\.|__tests__)/.test(file)),
    ...clientFiles
      .filter((file) => ROOT_CLIENT_MAP[file])
      .map((file) => ROOT_CLIENT_MAP[file]),
  ]),
];
const relatedSources = clientFiles.filter(
  (file) => !directTests.includes(file) && !ROOT_CLIENT_MAP[file],
);

logStep(
  "test:client:related",
  `Running focused client tests for ${clientFiles.length} changed file(s)...`,
);

if (clientFiles.length === 0) {
  logStep(
    "test:client:related",
    "No changed client source files require tests.",
  );
  process.exit(0);
}

if (directTests.length > 0) {
  runNpx(
    `vitest run --pool=forks --passWithNoTests ${quoteFiles(
      directTests.map((file) => file.slice("client/".length)),
    )}`,
    {
      cwd: `${repoRoot}/client`,
    },
  );
}

if (relatedSources.length > 0) {
  runNpx(
    `vitest related --run --pool=forks --passWithNoTests ${quoteFiles(
      relatedSources.map((file) => file.slice("client/".length)),
    )}`,
    {
      cwd: `${repoRoot}/client`,
    },
  );
}
