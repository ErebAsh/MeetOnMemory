import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes } from "react-router-dom";
import ProtectedRoutes from "../ProtectedRoutes";
import AppContent from "../../context/AppContent";
import meetingRiskApi from "../../services/meetingRiskApi";
import { organizationApi } from "../../services/organizationApi";

vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ orgId: "org_1" }),
}));

vi.mock("../../services/meetingRiskApi", () => ({
  default: {
    getRiskDashboard: vi.fn(),
    mitigateRisk: vi.fn(),
  },
}));

vi.mock("../../services/organizationApi", () => ({
  organizationApi: {
    getMembers: vi.fn(),
  },
}));

describe("RiskRegister Route Wiring (#2644)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingRiskApi.getRiskDashboard.mockResolvedValue({
      success: true,
      data: {
        risks: [
          {
            _id: "r_1",
            title: "Vendor Dependency Outage",
            category: "Technical",
            probability: 4,
            impact: 5,
            severityScore: 20,
            status: "Identified",
          },
        ],
        escalations: [],
      },
    });

    organizationApi.getMembers.mockResolvedValue({
      data: {
        success: true,
        data: [{ user: { _id: "u_1", name: "Risk Manager" } }],
      },
    });
  });

  const renderRoute = (initialPath = "/risks") => {
    const mockContext = {
      userData: {
        _id: "u_1",
        email: "user@example.com",
        currentOrganization: "org_1",
        role: "admin",
        hasCompletedOnboarding: true,
      },
      isLoggedin: true,
    };

    return render(
      <AppContent.Provider value={mockContext}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>{ProtectedRoutes}</Routes>
        </MemoryRouter>
      </AppContent.Provider>,
    );
  };

  it("successfully mounts RiskRegister on /risks within ProtectedRoutes", async () => {
    renderRoute("/risks");

    await waitFor(
      () => {
        expect(
          screen.getByText("Vendor Dependency Outage"),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("successfully mounts RiskRegister on alias /risk-register", async () => {
    renderRoute("/risk-register");

    await waitFor(
      () => {
        expect(
          screen.getByText("Vendor Dependency Outage"),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});
