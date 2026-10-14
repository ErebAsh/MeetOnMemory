import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "../ProtectedRoute";
import AppContent from "../../context/AppContent";
import * as useRBACHook from "../../hooks/useRBAC";

// Mock the useRBAC hook
vi.mock("../../hooks/useRBAC", () => ({
  useRBAC: vi.fn(),
}));

// Helper component to check current route
const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
};

const renderWithProviders = (ui, contextValue, initialRoute = "/") => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppContent.Provider value={contextValue}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/login" element={<LocationDisplay />} />
          <Route path="/organizations" element={<LocationDisplay />} />
          <Route path="/dashboard" element={<LocationDisplay />} />
        </Routes>
      </AppContent.Provider>
    </MemoryRouter>,
  );
};

describe("ProtectedRoute", () => {
  it("shows loading state when loading is true", () => {
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: vi.fn(),
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { loading: true, isLoggedin: false, userData: null },
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects to login if user is not logged in", () => {
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: vi.fn(),
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { loading: false, isLoggedin: false, userData: null },
    );

    expect(screen.getByTestId("location-display")).toHaveTextContent("/login");
  });

  it("redirects to login when logged in but user data is missing", () => {
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: vi.fn(),
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { loading: false, isLoggedin: true, userData: null },
    );

    expect(screen.getByTestId("location-display")).toHaveTextContent("/login");
  });

  it("redirects to /organizations if onboarding is not completed and not on an onboarding page", () => {
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: vi.fn(),
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        loading: false,
        isLoggedin: true,
        userData: { hasCompletedOnboarding: false },
      },
      "/",
    );

    expect(screen.getByTestId("location-display")).toHaveTextContent(
      "/organizations",
    );
  });

  it("allows onboarding users to access browse-organizations (#293)", () => {
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/browse-organizations"]}>
        <AppContent.Provider
          value={{
            loading: false,
            isLoggedin: true,
            userData: { hasCompletedOnboarding: false },
          }}
        >
          <Routes>
            <Route
              path="/browse-organizations"
              element={
                <ProtectedRoute>
                  <div>Browse Organizations</div>
                </ProtectedRoute>
              }
            />
            <Route path="/organizations" element={<LocationDisplay />} />
          </Routes>
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Browse Organizations")).toBeInTheDocument();
  });

  it("redirects to /dashboard if onboarding is completed but user is on an onboarding page", () => {
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/organizations"]}>
        <AppContent.Provider
          value={{
            loading: false,
            isLoggedin: true,
            userData: { hasCompletedOnboarding: true },
          }}
        >
          <Routes>
            <Route
              path="/organizations"
              element={
                <ProtectedRoute>
                  <div>Onboarding Page</div>
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard" element={<LocationDisplay />} />
          </Routes>
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("location-display")).toHaveTextContent(
      "/dashboard",
    );
  });

  it("redirects to dashboard if user lacks required RBAC permissions", () => {
    const mockHasPermission = vi.fn().mockReturnValue(false);
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: mockHasPermission,
    });

    renderWithProviders(
      <ProtectedRoute resource="meetings" action="delete">
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        loading: false,
        isLoggedin: true,
        userData: { hasCompletedOnboarding: true },
      },
    );

    expect(mockHasPermission).toHaveBeenCalledWith("meetings", "delete");
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it("renders children if user has required permissions", () => {
    const mockHasPermission = vi.fn().mockReturnValue(true);
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: mockHasPermission,
    });

    renderWithProviders(
      <ProtectedRoute resource="meetings" action="view">
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        loading: false,
        isLoggedin: true,
        userData: { hasCompletedOnboarding: true },
      },
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("renders forbiddenFallback when permission is denied", () => {
    const mockHasPermission = vi.fn().mockReturnValue(false);
    vi.spyOn(useRBACHook, "useRBAC").mockReturnValue({
      hasPermission: mockHasPermission,
    });

    renderWithProviders(
      <ProtectedRoute
        resource="admin_panel"
        action="view"
        forbiddenFallback={<div>Access Denied Page</div>}
      >
        <div>Admin Content</div>
      </ProtectedRoute>,
      {
        loading: false,
        isLoggedin: true,
        userData: { hasCompletedOnboarding: true },
      },
    );

    expect(screen.getByText("Access Denied Page")).toBeInTheDocument();
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });
});
