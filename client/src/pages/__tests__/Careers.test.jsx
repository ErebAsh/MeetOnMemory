import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Careers from "../Careers.jsx";
import { submitCareerApplication } from "../../services/careersApi.js";
import { toast } from "react-toastify";

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

const createResumeFile = (name = "resume.pdf") =>
  new File(["%PDF-1.4"], name, { type: "application/pdf" });

const openFirstJobApplication = async () => {
  fireEvent.click(screen.getByText("Senior Frontend Engineer"));
  fireEvent.click(
    screen.getByRole("button", { name: "Apply for this Position" }),
  );
  await waitFor(() => {
    expect(
      screen.getByRole("heading", {
        name: /Apply for Senior Frontend Engineer/i,
      }),
    ).toBeInTheDocument();
  });
};

describe("Careers application submission (#1790)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits the application and resume after a successful backend response", async () => {
    submitCareerApplication.mockResolvedValueOnce({ status: 201, data: {} });

    render(<Careers />);
    await openFirstJobApplication();

    fireEvent.change(screen.getByPlaceholderText("John Doe"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
      target: { value: "jane@example.com" },
    });

    const resumeInput = screen.getByLabelText(/Resume \(PDF or DOCX\)/i);
    fireEvent.change(resumeInput, {
      target: { files: [createResumeFile()] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Application" }));

    await waitFor(() => {
      expect(submitCareerApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Jane Doe",
          email: "jane@example.com",
          jobId: "sr-frontend",
          resumeFile: expect.any(File),
        }),
      );
    });

    expect(toast.success).toHaveBeenCalledWith(
      "✨ Application submitted successfully! We will contact you soon.",
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", {
        name: /Apply for Senior Frontend Engineer/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows an error state when the backend rejects the submission", async () => {
    submitCareerApplication.mockRejectedValueOnce({
      response: { data: { message: "Server unavailable." }, status: 503 },
      message: "Server unavailable.",
    });

    render(<Careers />);
    await openFirstJobApplication();

    fireEvent.change(screen.getByPlaceholderText("John Doe"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Resume \(PDF or DOCX\)/i), {
      target: { files: [createResumeFile()] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Application" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Server unavailable.",
      );
    });

    expect(toast.error).toHaveBeenCalledWith("Server unavailable.");
    expect(toast.success).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", {
        name: /Apply for Senior Frontend Engineer/i,
      }),
    ).toBeInTheDocument();
  });

  it("blocks invalid resume file types before calling the API", async () => {
    render(<Careers />);
    await openFirstJobApplication();

    fireEvent.change(screen.getByPlaceholderText("John Doe"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Resume \(PDF or DOCX\)/i), {
      target: { files: [createResumeFile("resume.exe")] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Application" }));

    expect(submitCareerApplication).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Resume must be a PDF or DOCX file.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Resume must be a PDF or DOCX file.",
    );
  });

  it("requires name, email, and resume before submitting", async () => {
    render(<Careers />);
    await openFirstJobApplication();

    fireEvent.click(screen.getByRole("button", { name: "Submit Application" }));

    expect(submitCareerApplication).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Please fill in all required fields (Name, Email, Resume).",
    );
  });

  it("prevents duplicate submissions while a request is pending", async () => {
    let resolveSubmit;
    submitCareerApplication.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(<Careers />);
    await openFirstJobApplication();

    fireEvent.change(screen.getByPlaceholderText("John Doe"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Resume \(PDF or DOCX\)/i), {
      target: { files: [createResumeFile()] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Application" }));

    const submittingButton = screen.getByRole("button", {
      name: "Submitting...",
    });
    expect(submittingButton).toBeDisabled();

    fireEvent.click(submittingButton);
    expect(submitCareerApplication).toHaveBeenCalledTimes(1);

    resolveSubmit({ status: 201, data: {} });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("does not show success toast unless the backend returns 200 or 201", async () => {
    submitCareerApplication.mockResolvedValueOnce({ status: 202, data: {} });

    render(<Careers />);
    await openFirstJobApplication();

    fireEvent.change(screen.getByPlaceholderText("John Doe"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Resume \(PDF or DOCX\)/i), {
      target: { files: [createResumeFile()] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Application" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Application submission failed.",
      );
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", {
        name: /Apply for Senior Frontend Engineer/i,
      }),
    ).toBeInTheDocument();
  });
});
