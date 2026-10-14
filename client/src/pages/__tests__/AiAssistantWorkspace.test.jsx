// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AiAssistant from "../AiAssistant.jsx";
import useAssistant from "../../context/useAssistant.js";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../context/useAssistant.js");
vi.mock("../../context/AppContent.js", () => ({
  default: React.createContext({ isLoggedin: true }),
}));

describe("AiAssistant Workspace Page (#2011)", () => {
  const mockAssistantCtx = {
    sessions: [{ _id: "s-1", id: "s-1", title: "Project Sync" }],
    currentSessionId: "s-1",
    messages: [
      { role: "assistant", content: "Hello! How can I assist you today?" },
    ],
    inputValue: "",
    setInputValue: vi.fn(),
    isStreaming: false,
    error: "",
    isSocketConnected: true,
    isRateLimited: false,
    pinnedContext: {
      type: "meeting",
      refId: "m-123",
      title: "Sprint 42 Retrospective",
    },
    handleSelectSession: vi.fn(),
    handleNewSession: vi.fn(),
    handleDeleteSession: vi.fn(),
    handleRenameSession: vi.fn(),
    handleSendMessage: vi.fn((e) => e?.preventDefault?.()),
    ensureSessionAndPin: vi.fn().mockResolvedValue(),
    handleUnpinContext: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAssistant.mockReturnValue(mockAssistantCtx);
  });

  it("renders workspace page with session title, pinned context, and message stream without redirecting", () => {
    render(
      <MemoryRouter initialEntries={["/assistant"]}>
        <AiAssistant />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Project Sync")[0]).toBeInTheDocument();
    expect(screen.getByText("Pinned Context:")).toBeInTheDocument();
    expect(screen.getByText("Sprint 42 Retrospective")).toBeInTheDocument();
    expect(
      screen.getByText("Hello! How can I assist you today?"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Ask assistant about meetings, notes, or action items...",
      ),
    ).toBeInTheDocument();
  });

  it("triggers handleSendMessage when submit button is clicked", () => {
    mockAssistantCtx.inputValue = "What are the action items?";
    render(
      <MemoryRouter initialEntries={["/assistant"]}>
        <AiAssistant />
      </MemoryRouter>,
    );

    const sendBtn = screen.getByRole("button", { name: /send/i });
    fireEvent.click(sendBtn);

    expect(mockAssistantCtx.handleSendMessage).toHaveBeenCalled();
  });

  it("consumes deep-link query params and calls ensureSessionAndPin", async () => {
    render(
      <MemoryRouter
        initialEntries={["/assistant?meetingId=meet-999&title=Q3+Planning"]}
      >
        <AiAssistant />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockAssistantCtx.ensureSessionAndPin).toHaveBeenCalledWith({
        type: "meeting",
        refId: "meet-999",
        title: "Q3 Planning",
      });
    });
  });
});
