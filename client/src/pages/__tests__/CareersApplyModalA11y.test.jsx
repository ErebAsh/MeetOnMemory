import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Careers from "../Careers.jsx";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <nav>Navbar</nav>,
}));

vi.mock("../../services/careersApi.js", () => ({
  submitCareerApplication: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}));

vi.mock("lucide-react", () => {
  const Icon = () => <span />;
  return {
    Briefcase: Icon,
    MapPin: Icon,
    Users: Icon,
    CheckCircle2: Icon,
    ArrowRight: Icon,
    Search: Icon,
    Building: Icon,
    Clock: Icon,
    Heart: Icon,
    Sparkles: Icon,
    DollarSign: Icon,
    GraduationCap: Icon,
    X: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Award: Icon,
    Coffee: Icon,
    Globe: Icon,
    HelpCircle: Icon,
  };
});

const openModalViaFirstJob = () => {
  fireEvent.click(screen.getByText("Senior Frontend Engineer"));
  const applyButton = screen.getByRole("button", {
    name: "Apply for this Position",
  });
  fireEvent.click(applyButton);
  return applyButton;
};

describe("Careers Apply Modal Accessibility (#1792)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the modal with dialog semantics and an accessible name", () => {
    render(<Careers />);
    openModalViaFirstJob();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");

    const titleId = dialog.getAttribute("aria-labelledby");
    const titleEl = document.getElementById(titleId);
    expect(titleEl).toBeInTheDocument();
    expect(titleEl).toHaveTextContent(/Apply for Senior Frontend Engineer/i);
  });

  it("moves focus into the modal when it opens", async () => {
    render(<Careers />);
    openModalViaFirstJob();

    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it("traps Tab focus inside the modal", () => {
    render(<Careers />);
    openModalViaFirstJob();

    const dialog = screen.getByRole("dialog");
    const focusables = [
      ...dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    expect(focusables.length).toBeGreaterThan(1);

    const lastFocusable = focusables[focusables.length - 1];
    lastFocusable.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(focusables[0]);
  });

  it("wraps Shift+Tab from the first focusable to the last", () => {
    render(<Careers />);
    openModalViaFirstJob();

    const dialog = screen.getByRole("dialog");
    const focusables = [
      ...dialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    expect(focusables.length).toBeGreaterThan(1);

    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];

    firstFocusable.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastFocusable);
  });

  it("closes the modal on Escape", () => {
    render(<Careers />);
    openModalViaFirstJob();

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the modal when the backdrop overlay is clicked", () => {
    render(<Careers />);
    openModalViaFirstJob();

    const backdrop = screen.getByRole("dialog").parentElement;
    fireEvent.click(backdrop);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close the modal when clicking inside the dialog", () => {
    render(<Careers />);
    openModalViaFirstJob();

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("returns focus to the trigger element after the modal closes", async () => {
    render(<Careers />);

    fireEvent.click(screen.getByText("Senior Frontend Engineer"));
    const applyButton = screen.getByRole("button", {
      name: "Apply for this Position",
    });
    applyButton.focus();
    fireEvent.click(applyButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => {
      expect(document.activeElement).toBe(applyButton);
    });
  });
});
