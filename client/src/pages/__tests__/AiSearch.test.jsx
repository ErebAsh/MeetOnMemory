import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AiSearch from "../AiSearch";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

const apiPost = vi.fn();

vi.mock("../../services", () => ({
  apiClient: {
    post: (...args) => apiPost(...args),
  },

  searchApi: {
    voiceSearch: vi.fn(),
    federatedSearch: (payload) => apiPost("/api/search/federated", payload),
    hybridSearch: (payload) => apiPost("/api/search/hybrid", payload),
    semanticSearch: (payload) => apiPost("/api/search", payload),
  },

  savedFilterApi: {
    getSavedFilters: vi.fn().mockResolvedValue({ data: [] }),
    createSavedFilter: vi.fn(),
    deleteSavedFilter: vi.fn(),
  },
}));

const renderAiSearch = (initialEntry = "/ai-search") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AiSearch />
    </MemoryRouter>,
  );

const getQueryInput = () => screen.getByPlaceholderText(/ask e\.g\./i);

describe("AiSearch meeting navigation (#615)", () => {
  let openSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    const store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    });
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy?.mockRestore();
  });

  it("opens the singular /meeting/:id route from a standard search result", async () => {
    apiPost.mockResolvedValue({
      data: {
        results: [
          {
            meetingId: "mtg-123",
            title: "Sprint Planning",
            summary: "Discussed backlog",
            resultType: "meeting",
            createdAt: "2024-06-01T00:00:00.000Z",
          },
        ],
      },
    });

    renderAiSearch();

    fireEvent.change(getQueryInput(), {
      target: { value: "sprint planning" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByText("Sprint Planning")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /open meeting/i }));

    expect(openSpy).toHaveBeenCalledWith("/meeting/mtg-123", "_blank");
    expect(
      openSpy.mock.calls.some(([url]) => String(url).includes("/meetings/")),
    ).toBe(false);
  });

  it("opens /meeting/:id from a hybrid search result source meeting", async () => {
    apiPost.mockResolvedValue({
      data: {
        results: [
          {
            key: "decision-1",
            type: "decision",
            id: "dec-1",
            title: "Ship v2",
            summary: "Approved shipping",
            semanticScore: 0.8,
            graphScore: 0.4,
            finalScore: 0.7,
            hops: 1,
            sourceMeeting: {
              id: "mtg-456",
              createdAt: "2024-07-01T00:00:00.000Z",
            },
          },
        ],
      },
    });

    renderAiSearch();

    fireEvent.click(screen.getByRole("button", { name: /hybrid/i }));
    fireEvent.change(getQueryInput(), {
      target: { value: "ship v2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByText("Ship v2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /open meeting/i }));

    expect(openSpy).toHaveBeenCalledWith("/meeting/mtg-456", "_blank");
  });

  it("passes advanced filters to hybrid search and stores history (#2085)", async () => {
    apiPost.mockResolvedValue({ data: { results: [] } });

    renderAiSearch();

    fireEvent.click(screen.getByRole("button", { name: /hybrid/i }));
    fireEvent.change(getQueryInput(), {
      target: { value: "budget review" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. finance/i), {
      target: { value: "finance" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/search/hybrid",
        expect.objectContaining({
          query: "budget review",
          tag: "finance",
        }),
      );
    });

    expect(
      screen.getByRole("button", { name: /budget review/i }),
    ).toBeInTheDocument();
  });

  it("renders AI answer panel and filters by organizer/department (#2590)", async () => {
    apiPost.mockResolvedValue({
      data: {
        results: [],
        aiAnswer:
          "Here is the result from the marketing team [Campaign Sync](mtg-123#t=45).",
      },
    });

    renderAiSearch();

    fireEvent.click(screen.getByRole("button", { name: /hybrid/i }));

    fireEvent.change(getQueryInput(), {
      target: { value: "campaign target" },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/name or email/i)[1], {
      target: { value: "Search Expert" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Sales/i), {
      target: { value: "Marketing" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/api/search/hybrid",
        expect.objectContaining({
          query: "campaign target",
          organizer: "Search Expert",
          department: "Marketing",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/AI Assistant Answer/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Campaign Sync/i }),
      ).toBeInTheDocument();
    });
  });
});
