import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Summaries from "../Summaries.jsx";
import AiSearch from "../AiSearch.jsx";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, fallback) => (typeof fallback === "string" ? fallback : key),
  }),
}));

vi.mock("../../hooks/useExport.js", () => ({
  default: () => ({
    exportMeeting: vi.fn(),
    isExporting: false,
  }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const getAllMeetings = vi.fn();
const deleteMeeting = vi.fn();
const apiPost = vi.fn();
const mockSemanticSearch = vi.fn();

vi.mock("../../services", () => ({
  meetingApi: {
    getAllMeetings: (...args) => getAllMeetings(...args),
    deleteMeeting: (...args) => deleteMeeting(...args),
  },
  apiClient: {
    post: (...args) => apiPost(...args),
  },
  searchApi: {
    semanticSearch: (...args) => mockSemanticSearch(...args),
    hybridSearch: vi.fn(),
    federatedSearch: vi.fn(),
    voiceSearch: vi.fn(),
  },
  savedFilterApi: {
    getSavedFilters: vi.fn().mockResolvedValue({ data: [] }),
    createSavedFilter: vi.fn(),
    deleteSavedFilter: vi.fn(),
  },
}));

describe("Summary and AI Search Modal Accessibility (#1684)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Summaries ViewModal", () => {
    it("renders dialog with accessible semantics, traps focus, and closes on Escape", async () => {
      getAllMeetings.mockResolvedValueOnce({
        data: {
          success: true,
          meetings: [
            {
              _id: "m-1",
              title: "Product Roadmap Sync",
              summary: "Discussion on Q3 goals",
              createdAt: "2026-08-01T10:00:00.000Z",
            },
          ],
          pagination: {
            total: 1,
            page: 1,
            limit: 9,
            totalPages: 1,
          },
        },
      });

      render(<Summaries />);

      await waitFor(() => {
        expect(screen.getByText("Product Roadmap Sync")).toBeInTheDocument();
      });

      // Click "View" button to open modal
      const viewBtn = screen.getByRole("button", { name: /view/i });
      fireEvent.click(viewBtn);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby");

      const titleId = dialog.getAttribute("aria-labelledby");
      expect(document.getElementById(titleId)).toHaveTextContent(
        "Product Roadmap Sync",
      );

      // Verify close button has aria-label
      const closeBtn = screen.getByRole("button", { name: /close modal/i });
      expect(closeBtn).toBeInTheDocument();

      // Test focus trapping
      const focusables = dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      expect(focusables.length).toBeGreaterThan(1);
      const firstFocusable = focusables[0];
      const lastFocusable = focusables[focusables.length - 1];

      // Shift+Tab from first focusable moves to last
      firstFocusable.focus();
      fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(lastFocusable);

      // Tab from last focusable wraps to first
      lastFocusable.focus();
      fireEvent.keyDown(dialog, { key: "Tab", shiftKey: false });
      expect(document.activeElement).toBe(firstFocusable);

      // Escape closes the modal
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("AiSearch ResultModal", () => {
    it("renders dialog with accessible semantics, traps focus, and closes on Escape", async () => {
      mockSemanticSearch.mockResolvedValueOnce({
        results: [
          {
            meetingId: "search-1",
            title: "AI Strategy Deep Dive",
            summary: "Detailed review of AI algorithms",
            transcript: "Full transcript here",
            createdAt: "2026-08-05T12:00:00.000Z",
            resultType: "meeting",
          },
        ],
      });

      render(
        <MemoryRouter>
          <AiSearch />
        </MemoryRouter>,
      );

      const searchInput = screen.getByPlaceholderText(
        /Ask e\.g\. 'What decisions were made in the finance meeting\?'/i,
      );
      fireEvent.change(searchInput, { target: { value: "strategy" } });

      const searchButton = screen.getByRole("button", { name: /^Search$/i });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("AI Strategy Deep Dive")).toBeInTheDocument();
      });

      // Click "View Details" to open ResultModal
      const viewDetailsBtn = screen.getByRole("button", {
        name: /view details/i,
      });
      fireEvent.click(viewDetailsBtn);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby");

      const titleId = dialog.getAttribute("aria-labelledby");
      expect(document.getElementById(titleId)).toHaveTextContent(
        "AI Strategy Deep Dive",
      );

      const closeBtn = screen.getByRole("button", { name: /close modal/i });
      expect(closeBtn).toBeInTheDocument();

      // Test focus trapping
      const focusables = dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      expect(focusables.length).toBeGreaterThanOrEqual(1);

      // Escape closes ResultModal
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
