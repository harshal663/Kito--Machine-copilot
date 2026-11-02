import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SignInPage from "@/app/sign-in/page";
import SignUpPage from "@/app/sign-up/page";
import { apiClient, ApiError } from "@/lib/api-client";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    details?: unknown;
    constructor(code: string, message: string, status: number = 400, details?: unknown) {
      super(message);
      this.code = code;
      this.status = status;
      this.details = details;
    }
  },
}));

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders with structure, brand mark, skip-link, and testids", () => {
    render(<SignInPage />);

    expect(screen.getByRole("link", { name: /Skip to sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sign in|Welcome back/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByTestId("sign-in-form")).toBeInTheDocument();
    expect(screen.getByTestId("sign-in-submit")).toBeInTheDocument();
  });

  it("toggles password visibility with accessible aria-pressed", () => {
    render(<SignInPage />);

    const toggleButton = screen.getByRole("button", { name: "Show password" });
    const passwordInput = screen.getByLabelText("Password");

    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    expect(passwordInput).toHaveAttribute("type", "password");

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(passwordInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("displays uniform 'Email or password is incorrect.' error without revealing account existence", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(
      new ApiError("UNAUTHENTICATED", "Invalid credentials", 401)
    );

    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123456" },
    });

    fireEvent.click(screen.getByTestId("sign-in-submit"));

    await waitFor(() => {
      const errorAlert = screen.getByTestId("sign-in-error");
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveTextContent("Email or password is incorrect.");
    });
  });

  it("displays locked message on rate limit", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(
      new ApiError("RATE_LIMITED", "Too many attempts", 429)
    );

    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "locked@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123456" },
    });

    fireEvent.click(screen.getByTestId("sign-in-submit"));

    await waitFor(() => {
      const errorAlert = screen.getByTestId("sign-in-error");
      expect(errorAlert).toHaveTextContent("Too many attempts. Try again later.");
    });
  });
});

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders sign-up structure, 12-char hint, and fields", () => {
    render(<SignUpPage />);

    expect(screen.getByRole("link", { name: /Skip to sign up/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create your account", level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText("At least 12 characters.")).toBeInTheDocument();
  });

  it("validates 12 character minimum for password before submission", async () => {
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Operator Smith" },
    });
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "smith@factory.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "short123" },
    });

    fireEvent.click(screen.getByTestId("sign-up-submit"));

    await waitFor(() => {
      expect(screen.getByText("Password must be at least 12 characters.")).toBeInTheDocument();
    });
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
