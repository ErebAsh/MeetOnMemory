import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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

const SR_FRONTEND_LABEL = /Toggle details for Senior Frontend Engineer/i;
const SR_FRONTEND_DESCRIPTION =
  /Join us in crafting the frontend architecture for our real-time meeting transcription/i;

const getSeniorFrontendToggle = () =>
  screen.getByRole("button", { name: SR_FRONTEND_LABEL });

const assertNoSelectNoneAncestor = (element) => {
  let node = element;
  while (node) {
    expect(node.className || "").not.toMatch(/\bselect-none\b/);
    node = node.parentElement;
  }
};

describe("Careers accessibility (#1791)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not apply select-none at the page root", () => {
    const { container } = render(<Careers />);
    const root = container.firstChild;
    expect(root.className).not.toMatch(/\bselect-none\b/);
  });

  it("allows job descriptions to be highlighted and copied", () => {
    render(<Careers />);

    fireEvent.click(getSeniorFrontendToggle());

    const description = screen.getByText(SR_FRONTEND_DESCRIPTION);
    assertNoSelectNoneAncestor(description);
    expect(description.tagName).toBe("P");
  });

  it("exposes job rows as keyboard-focusable controls", () => {
    render(<Careers />);

    const jobToggles = screen.getAllByRole("button", {
      name: /Toggle details for/i,
    });

    expect(jobToggles.length).toBeGreaterThan(0);
    jobToggles.forEach((toggle) => {
      expect(toggle).toHaveAttribute("tabindex", "0");
      expect(toggle).toHaveAttribute("aria-expanded");
      expect(toggle).toHaveAttribute("aria-controls");
    });
  });

  it("expands and collapses a job row when Enter is pressed", () => {
    render(<Careers />);

    const toggle = getSeniorFrontendToggle();
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(toggle, { key: "Enter" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(SR_FRONTEND_DESCRIPTION)).toBeInTheDocument();

    fireEvent.keyDown(toggle, { key: "Enter" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("expands and collapses a job row when Space is pressed", () => {
    render(<Careers />);

    const toggle = getSeniorFrontendToggle();
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(toggle, { key: " " });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(SR_FRONTEND_DESCRIPTION)).toBeInTheDocument();

    fireEvent.keyDown(toggle, { key: " " });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("preserves mouse click behavior for expanding job rows", () => {
    render(<Careers />);

    const toggle = getSeniorFrontendToggle();
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(SR_FRONTEND_DESCRIPTION)).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("does not nest the apply action inside the job toggle control", () => {
    render(<Careers />);

    fireEvent.click(getSeniorFrontendToggle());

    const applyButton = screen.getByRole("button", {
      name: "Apply for this Position",
    });
    const jobToggle = getSeniorFrontendToggle();

    expect(jobToggle).not.toContainElement(applyButton);
  });
});
