import { describe, it, expect, jest } from "@jest/globals";

jest.unstable_mockModule("../controllers/meetingController.js", () => ({
  createMeeting: jest.fn(),
  uploadMeeting: jest.fn(),
  uploadAudioForMeeting: jest.fn(),
  summarizeMeeting: jest.fn(),
  getAllMeetings: jest.fn(),
  getMeetingById: jest.fn(),
  updateMeeting: jest.fn(),
  deleteMeeting: jest.fn(),
  getDeletedMeetings: jest.fn(),
  restoreDeletedMeeting: jest.fn(),
  permanentlyDeleteMeeting: jest.fn(),
  getPurgePreviewController: jest.fn(),
  purgeTrashController: jest.fn(),
  searchMeetingsByText: jest.fn(),
  archiveMeeting: jest.fn(),
  restoreMeeting: jest.fn(),
  notifyLiveMeeting: jest.fn(),
  handleMeetingClipOperation: jest.fn(),
  getMeetingClip: jest.fn(),
  getMeetingInvite: jest.fn(),
  regenerateMeetingInvite: jest.fn(),
  updateMeetingInvite: jest.fn(),
  resolveMeetingInvite: jest.fn(),
  anonymizeMeeting: jest.fn(),
  getRawTranscript: jest.fn(),
  cloneMeeting: jest.fn(),
  exportMeetingNotes: jest.fn(),
}));

jest.unstable_mockModule("../controllers/bookmarkController.js", () => ({
  addMeetingBookmark: jest.fn(),
  removeMeetingBookmark: jest.fn(),
  getMeetingBookmarkStatus: jest.fn(),
  getBookmarkedMeetings: jest.fn(),
}));

jest.unstable_mockModule("../controllers/digestController.js", () => ({
  resendDigest: jest.fn(),
  previewDigest: jest.fn(),
}));

jest.unstable_mockModule("../controllers/reactionController.js", () => ({
  getReactionSummary: jest.fn(),
  getReactionTimeline: jest.fn(),
}));

jest.unstable_mockModule("../controllers/exportController.js", () => ({
  exportMeeting: jest.fn(),
}));

jest.unstable_mockModule("../controllers/transcriptController.js", () => ({
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  uploadTranscriptAudio: jest.fn(),
  getTranscript: jest.fn(),
  retryTranscription: jest.fn(),
  uploadTranscriptChunk: jest.fn(),
  storeEncryptedTranscript: jest.fn(),
  persistCaptionSegments: jest.fn(),
}));

jest.unstable_mockModule("../controllers/roleRotationController.js", () => ({
  getMeetingRoles: jest.fn(),
}));

jest.unstable_mockModule("../controllers/meetingQuizController.js", () => ({
  getOrgRetentionLeaderboard: jest.fn(),
}));

jest.unstable_mockModule(
  "../controllers/meetingOwnershipTransferController.js",
  () => ({
    initiateTransfer: jest.fn(),
  }),
);

const { meetingRecordingFilter, transcriptChunkUpload } =
  await import("../routes/meetingRoutes.js");

describe("Transcript Chunk Upload Multer fileFilter (#2651)", () => {
  it("has fileFilter attached to transcriptChunkUpload", () => {
    expect(transcriptChunkUpload).toBeDefined();
    expect(typeof transcriptChunkUpload.single).toBe("function");
  });

  it("accepts valid audio/video files with matching MIME types", () => {
    const validFiles = [
      { originalname: "recording.mp3", mimetype: "audio/mpeg" },
      { originalname: "audio_chunk.wav", mimetype: "audio/wav" },
      { originalname: "voice.m4a", mimetype: "audio/m4a" },
      { originalname: "meeting.webm", mimetype: "audio/webm" },
      { originalname: "session.mp4", mimetype: "video/mp4" },
      { originalname: "stream.ogg", mimetype: "audio/ogg" },
      { originalname: "audio.flac", mimetype: "audio/flac" },
      { originalname: "audio.aac", mimetype: "audio/aac" },
    ];

    validFiles.forEach((file) => {
      const cb = jest.fn();
      meetingRecordingFilter({}, file, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });
  });

  it("rejects malicious or unsupported executable/document files", () => {
    const invalidFiles = [
      { originalname: "script.exe", mimetype: "application/x-msdownload" },
      { originalname: "payload.js", mimetype: "application/javascript" },
      { originalname: "shell.sh", mimetype: "text/x-shellscript" },
      { originalname: "document.pdf", mimetype: "application/pdf" },
      { originalname: "notes.txt", mimetype: "text/plain" },
      { originalname: "backdoor.php", mimetype: "application/x-php" },
    ];

    invalidFiles.forEach((file) => {
      const cb = jest.fn();
      meetingRecordingFilter({}, file, cb);
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            "Invalid meeting recording file type",
          ),
        }),
        false,
      );
    });
  });

  it("passes through if file object is empty/null", () => {
    const cb = jest.fn();
    meetingRecordingFilter({}, null, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });
});
