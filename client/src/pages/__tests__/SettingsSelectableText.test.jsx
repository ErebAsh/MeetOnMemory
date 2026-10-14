import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import Settings from "../Settings.jsx";
import AppContent from "../../context/AppContent.js";
import { ThemeProvider } from "../../context/ThemeContext.jsx";
import { PreferencesProvider } from "../../context/PreferencesContext.jsx";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

vi.mock("../../components/ClerkUserControls.jsx", () => ({
  ClerkManageAccountButton: ({ children }) => <button>{children}</button>,
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ user: { id: "user_1", emailAddresses: [] } }),
  useClerk: () => ({ openUserProfile: vi.fn() }),
  useSession: () => ({ session: { id: "sess_1" } }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    request: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
  },
  DEFAULT_TIMEOUT_MS: 30000,
}));

describe("Settings Page Selectable Text (#1796)", () => {
  const mockUserData = {
    name: "Jane Smith",
    email: "jane.smith@example.com",
    role: "admin",
    organization: "Acme Corp",
    timezone: "UTC",
    isAccountVerified: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not apply select-none to the main container", () => {
    const { container } = render(
      <BrowserRouter>
        <ThemeProvider>
          <PreferencesProvider>
            <AppContent.Provider
              value={{
                userData: mockUserData,
                setUserData: vi.fn(),
                backendUrl: "http://localhost:5000",
                isLoggedin: true,
              }}
            >
              <Settings />
            </AppContent.Provider>
          </PreferencesProvider>
        </ThemeProvider>
      </BrowserRouter>,
    );

    const root = container.firstChild;
    expect(root.className).not.toMatch(/\bselect-none\b/);
  });
});
