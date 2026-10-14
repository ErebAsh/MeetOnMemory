// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ReportBuilder from "../ReportBuilder.jsx";
import reportApi from "../../services/reportApi.js";
import { toast } from "react-toastify";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }) => <div>{children}</div>,
  Droppable: ({ children }) => children({ provided: {}, placeholder: null }),
  Draggable: ({ children }) => children({ provided: {} }),
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar" />,
}));

vi.mock("../../services/reportApi.js", () => ({
  default: {
    getTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    generateReport: vi.fn(),
    exportReport: vi.fn(),
  },
}));

describe("ReportBuilder End-to-End Generate & Export (#2278)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock createObjectURL & revokeObjectURL
    window.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    window.URL.revokeObjectURL = vi.fn();
  });

  it("successfully generates report payload and downloads exported CSV/PDF blobs", async () => {
    reportApi.getTemplateById.mockResolvedValue({
      data: {
        _id: "tpl_123",
        name: "Quarterly Performance",
        description: "Test description",
        sections: [
          {
            _id: "sec_1",
            type: "ACTION_ITEMS",
            title: "Action Items Summary",
            order: 0,
          },
        ],
        defaultFilters: { dateRangeDays: 30 },
      },
    });

    reportApi.generateReport.mockResolvedValue({
      data: {
        templateName: "Quarterly Performance",
        generatedAt: new Date().toISOString(),
        meetingCount: 3,
        sections: [
          {
            title: "Action Items Summary",
            type: "ACTION_ITEMS",
            data: [{ title: "Action 1", status: "completed" }],
          },
        ],
      },
    });

    reportApi.exportReport.mockResolvedValue({
      data: "col1,col2\nval1,val2",
      headers: { "content-type": "text/csv" },
    });

    render(
      <MemoryRouter initialEntries={["/reports/builder/tpl_123"]}>
        <Routes>
          <Route
            path="/reports/builder/:templateId"
            element={<ReportBuilder />}
          />
        </Routes>
      </MemoryRouter>,
    );

    // 1. Wait for template load
    await waitFor(() => {
      expect(
        screen.getByDisplayValue("Quarterly Performance"),
      ).toBeInTheDocument();
    });

    // 2. Trigger generate report
    const generateBtn = screen.getByRole("button", {
      name: /generate (preview|report)/i,
    });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(reportApi.generateReport).toHaveBeenCalledWith("tpl_123");
      expect(toast.success).toHaveBeenCalledWith("Report generated!");
    });

    // 3. Trigger CSV export & verify blob download link creation
    const csvExportBtn = screen.getByTitle("Export CSV");
    fireEvent.click(csvExportBtn);

    await waitFor(() => {
      expect(reportApi.exportReport).toHaveBeenCalledWith("tpl_123", "csv");
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
