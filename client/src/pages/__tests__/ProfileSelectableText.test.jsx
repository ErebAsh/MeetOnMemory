import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Profile from "../Profile.jsx";
import AppContent from "../../context/AppContent.js";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("axios", () => {
  const mockInstance = {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    request: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };
  return {
    default: {
      ...mockInstance,
      create: vi.fn(() => mockInstance),
    },
  };
});

describe("Profile Selectable Text (#1654)", () => {
  const mockUserData = {
    name: "Alex Doe",
    email: "alex@example.com",
    role: "Admin",
    bio: "Passionate software engineer building real-time applications.",
    isAccountVerified: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not apply select-none at the page root", () => {
    const { container } = render(
      <AppContent.Provider
        value={{ userData: mockUserData, setUserData: vi.fn() }}
      >
        <Profile />
      </AppContent.Provider>,
    );

    const root = container.firstChild;
    expect(root.className).not.toMatch(/\bselect-none\b/);
  });

  it("allows name, email, and bio text to be selectable without select-none", () => {
    render(
      <AppContent.Provider
        value={{ userData: mockUserData, setUserData: vi.fn() }}
      >
        <Profile />
      </AppContent.Provider>,
    );

    const nameEl = screen.getByRole("heading", { name: "Alex Doe" });
    const emailEl = screen.getByText("alex@example.com");
    const bioEl = screen.getByText(
      "Passionate software engineer building real-time applications.",
    );

    expect(nameEl.className).not.toMatch(/\bselect-none\b/);
    expect(emailEl.className).not.toMatch(/\bselect-none\b/);
    expect(bioEl.className).not.toMatch(/\bselect-none\b/);
  });
});
