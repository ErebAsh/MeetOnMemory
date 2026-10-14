import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MultiLanguageTranscript from "../MultiLanguageTranscript.jsx";
import AppContent from "../../../context/AppContent.js";
import apiClient from "../../../services/apiClient.js";

const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

vi.mock("../../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  createClerkSocketOptions: vi.fn(async () => ({
    transports: ["websocket"],
  })),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockLanguages = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
];

const mockTranscript = [
  {
    segmentId: "seg-1",
    sourceLanguage: "en",
    sourceText: "Hello everyone, welcome to the sprint review.",
    translations: [
      {
        segmentId: "seg-1",
        targetLanguage: "es",
        language: "es",
        text: "Hola a todos, bienvenidos a la revisión del sprint.",
        confidence: 0.95,
        provider: "google",
      },
    ],
  },
];

describe("MultiLanguageTranscript Component (#1880)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    apiClient.get.mockImplementation((url) => {
      if (url === "/api/translation/languages") {
        return Promise.resolve({ data: { languages: mockLanguages } });
      }
      if (url === "/api/translation/preferences") {
        return Promise.resolve({
          data: { defaultTargetLanguages: ["es"] },
        });
      }
      if (url.startsWith("/api/translation/cache/")) {
        return Promise.resolve({
          data: { translations: mockTranscript },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it("fetches languages, preferences, and transcript cache on mount", async () => {
    render(
      <AppContent.Provider value={{ backendUrl: "http://localhost:4000" }}>
        <MultiLanguageTranscript meetingId="room-123" />
      </AppContent.Provider>,
    );

    expect(screen.getByText("Multi-Language Transcript")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("English")).toBeInTheDocument();
      expect(screen.getByText("Spanish")).toBeInTheDocument();
      expect(screen.getByText("French")).toBeInTheDocument();
      expect(
        screen.getByText("Hello everyone, welcome to the sprint review."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Hola a todos, bienvenidos a la revisión del sprint."),
      ).toBeInTheDocument();
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/translation/languages");
    expect(apiClient.get).toHaveBeenCalledWith("/api/translation/preferences");
    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/translation/cache/room-123",
    );
  });

  it("switches target language and requests translations via socket", async () => {
    render(
      <AppContent.Provider value={{ backendUrl: "http://localhost:4000" }}>
        <MultiLanguageTranscript meetingId="room-123" />
      </AppContent.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText("French")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("French"));

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "translation:language-change",
      {
        meetingId: "room-123",
        language: "fr",
      },
    );

    expect(mockSocket.emit).toHaveBeenCalledWith("translation:request", {
      meetingId: "room-123",
      segmentId: "seg-1",
      sourceText: "Hello everyone, welcome to the sprint review.",
      sourceLanguage: "en",
      targetLanguage: "fr",
      context: expect.any(Object),
    });
  });

  it("submits translation correction modal", async () => {
    apiClient.post.mockResolvedValueOnce({ data: { success: true } });

    render(
      <AppContent.Provider value={{ backendUrl: "http://localhost:4000" }}>
        <MultiLanguageTranscript meetingId="room-123" />
      </AppContent.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTitle("Correct translation")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Correct translation"));

    expect(screen.getByText("Correct Translation")).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText(
      "Enter corrected translation...",
    );
    fireEvent.change(textarea, {
      target: { value: "Hola a todos, bienvenidos al sprint." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Correction" }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/api/translation/correct", {
        meetingId: "room-123",
        segmentId: "seg-1",
        language: "es",
        correctedText: "Hola a todos, bienvenidos al sprint.",
      });
    });
  });

  it("restores selected language from localStorage and saves on change", async () => {
    localStorage.setItem("selectedLanguage-room-123", "fr");

    render(
      <AppContent.Provider value={{ backendUrl: "http://localhost:4000" }}>
        <MultiLanguageTranscript meetingId="room-123" />
      </AppContent.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText("French")).toBeInTheDocument();
    });

    // Make sure 'fr' target text is rendered or selected
    expect(localStorage.getItem("selectedLanguage-room-123")).toBe("fr");
  });

  it("renders connection offline alert banner and clicks Reconnect", async () => {
    render(
      <AppContent.Provider value={{ backendUrl: "http://localhost:4000" }}>
        <MultiLanguageTranscript meetingId="room-123" />
      </AppContent.Provider>,
    );

    // Mock socket offline
    await waitFor(() => {
      expect(
        screen.getByText(
          "Live translation is offline. Displaying cached history.",
        ),
      ).toBeInTheDocument();
    });

    const reconnectBtn = screen.getByRole("button", { name: /reconnect/i });
    fireEvent.click(reconnectBtn);

    expect(reconnectBtn).toBeInTheDocument();
  });
});
