/**
 * Typed API client with automatic token injection, envelope unwrapping,
 * and structured error normalization.
 */

import { clearStoredToken, getStoredToken } from "./auth";
import type { ApiErrorResponse } from "../types";

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: Record<string, unknown> | undefined
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "http://localhost:8000";

interface RequestOptions extends Omit<RequestInit, "body"> {
  token?: string | null;
}

async function request<T>(
  path: string,
  options: RequestOptions & { body?: unknown; isFormData?: boolean } = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  const token = options.token !== undefined ? options.token : getStoredToken();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    headers,
  };
  if (options.method) {
    fetchOptions.method = options.method;
  }
  if (options.signal) {
    fetchOptions.signal = options.signal;
  }

  if (options.isFormData && options.body) {
    fetchOptions.body = options.body as FormData;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorDetails: Record<string, unknown> | undefined = undefined;

    try {
      const errJson = (await response.json()) as ApiErrorResponse;
      if (errJson.error) {
        errorCode = errJson.error.code || errorCode;
        errorMessage = errJson.error.message || errorMessage;
        errorDetails = errJson.error.details;
      }
    } catch {
      // Non-JSON error body fallback
    }

    if (response.status === 401) {
      clearStoredToken();
      if (
        typeof window !== "undefined" &&
        window.location &&
        !window.location.pathname?.startsWith("/sign-in") &&
        !window.location.pathname?.startsWith("/sign-up") &&
        !window.location.pathname?.startsWith("/login")
      ) {
        try {
          window.location.href = "/sign-in";
        } catch {
          // Ignore JSDOM navigation error in tests
        }
      }
    }

    throw new ApiError(errorCode, errorMessage, response.status, errorDetails);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const json = (await response.json()) as { data: T } | T;
  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "POST", body });
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "PUT", body });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "PATCH", body });
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "DELETE" });
  },

  upload<T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "POST", body: formData, isFormData: true });
  },
};
