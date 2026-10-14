import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import RbacPermissionExplorer from "../../../components/admin/RbacPermissionExplorer.jsx";
import { adminRbacApi } from "../../../services/adminRbacApi.js";

vi.mock("../../../services/adminRbacApi.js", () => ({
  adminRbacApi: {
    getMatrix: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("RbacPermissionExplorer", () => {
  const mockMatrixData = {
    roles: [
      { key: "owner", name: "Owner", description: "Full control", level: 5 },
      {
        key: "admin",
        name: "Administrator",
        description: "Full management",
        level: 4,
      },
      {
        key: "moderator",
        name: "Moderator",
        description: "Content moderation",
        level: 3,
      },
      {
        key: "member",
        name: "Member",
        description: "Standard access",
        level: 2,
      },
      {
        key: "viewer",
        name: "Viewer",
        description: "Read-only access",
        level: 1,
      },
      { key: "guest", name: "Guest", description: "Minimal access", level: 0 },
    ],
    roleHierarchy: {
      owner: 5,
      admin: 4,
      moderator: 3,
      member: 2,
      viewer: 1,
      guest: 0,
    },
    permissions: {
      meetings: {
        view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
        create: ["owner", "admin", "moderator", "member"],
        delete: ["owner", "admin"],
      },
      policies: {
        view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
        delete: ["owner", "admin"],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state and then permissions matrix", async () => {
    adminRbacApi.getMatrix.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockMatrixData,
      },
    });

    render(<RbacPermissionExplorer />);

    expect(
      screen.getByText(/Loading RBAC permission matrix/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/Access Audit & Denial Explainer/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Role × Permissions Matrix/i),
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText("Owner")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Viewer")[0]).toBeInTheDocument();
  });

  it("evaluates simulated access denial accurately", async () => {
    adminRbacApi.getMatrix.mockResolvedValueOnce({
      data: {
        success: true,
        data: mockMatrixData,
      },
    });

    render(<RbacPermissionExplorer />);

    await waitFor(() => {
      expect(
        screen.getByText(/Access Audit & Denial Explainer/i),
      ).toBeInTheDocument();
      // Default simulator has role viewer, resource meetings, action view -> permitted
      expect(screen.getByText(/Access Permitted/i)).toBeInTheDocument();
    });
  });
});
