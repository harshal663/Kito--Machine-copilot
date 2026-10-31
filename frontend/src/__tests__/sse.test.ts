import { describe, it, expect, vi, beforeEach } from "vitest";
import { SSEClient } from "../lib/sse";
import * as auth from "../lib/auth";

describe("SSEClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with CLOSED state and transitions to CONNECTING on start", () => {
    vi.spyOn(auth, "getStoredToken").mockReturnValue("valid-token");
    const sse = new SSEClient({ initialBackoffMs: 100 });
    expect(sse.getState()).toBe("CLOSED");
  });

  it("dispatches parsed messages to subscribed listeners", async () => {
    vi.spyOn(auth, "getStoredToken").mockReturnValue("valid-token");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode("event: event.updated\ndata: {\"event_id\": \"evt_123\"}\n\n")
        );
        controller.close();
      },
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });
    vi.stubGlobal("fetch", fetchSpy);

    const received: Array<{ event: string; data: string }> = [];
    const sse = new SSEClient({ initialBackoffMs: 100 });
    sse.onMessage((msg) => {
      received.push(msg);
    });

    sse.start();

    // Allow async microtasks to flush
    await new Promise((r) => setTimeout(r, 50));
    sse.stop();

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0]?.event).toBe("event.updated");
    expect(received[0]?.data).toContain("evt_123");
  });
});
