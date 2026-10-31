import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient, ApiError, API_BASE_URL } from "../lib/api-client";
import * as auth from "../lib/auth";

describe("apiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("unwraps { data: ... } envelope and includes Authorization header when token exists", async () => {
    vi.spyOn(auth, "getStoredToken").mockReturnValue("test-mock-token");

    const mockResponse = { data: { id: "mch_123", name: "Test Pump" } };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await apiClient.get<{ id: string; name: string }>("/v1/machines/mch_123");

    expect(result).toEqual({ id: "mch_123", name: "Test Pump" });
    expect(fetchSpy).toHaveBeenCalledWith(
      `${API_BASE_URL}/v1/machines/mch_123`,
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      })
    );

    const calledHeaders = fetchSpy.mock.calls[0]?.[1]?.headers as Headers;
    expect(calledHeaders.get("Authorization")).toBe("Bearer test-mock-token");
  });

  it("throws ApiError with closed error code on non-200 responses", async () => {
    vi.spyOn(auth, "getStoredToken").mockReturnValue(null);

    const errorResponse = {
      error: {
        code: "NOT_FOUND",
        message: "Machine with id mch_unknown not found.",
      },
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => errorResponse,
    });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(apiClient.get("/v1/machines/mch_unknown")).rejects.toThrow(ApiError);

    try {
      await apiClient.get("/v1/machines/mch_unknown");
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe("NOT_FOUND");
      expect(apiErr.status).toBe(404);
      expect(apiErr.message).toBe("Machine with id mch_unknown not found.");
    }
  });

  it("clears stored token when receiving 401 UNAUTHENTICATED", async () => {
    const clearSpy = vi.spyOn(auth, "clearStoredToken");

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({
        error: { code: "UNAUTHENTICATED", message: "Token expired" },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(apiClient.get("/v1/machines")).rejects.toThrow(ApiError);
    expect(clearSpy).toHaveBeenCalled();
  });
});
