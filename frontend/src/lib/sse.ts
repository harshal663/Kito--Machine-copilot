/**
 * Custom fetch-based Server-Sent Events (SSE) client supporting Bearer auth
 * and exponential reconnect backoff.
 */

import { API_BASE_URL } from "./api-client";
import { getStoredToken } from "./auth";

export type SSEConnectionState = "CONNECTING" | "OPEN" | "RECONNECTING" | "CLOSED";

export interface SSEMessage {
  event: string;
  data: string;
}

export type SSEEventHandler = (msg: SSEMessage) => void;
export type SSEStateChangeHandler = (state: SSEConnectionState) => void;

export interface SSEClientOptions {
  url?: string;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  onMessage?: SSEEventHandler;
  onStateChange?: SSEStateChangeHandler;
}

export class SSEClient {
  private url: string;
  private initialBackoffMs: number;
  private maxBackoffMs: number;
  private currentBackoffMs: number;
  private state: SSEConnectionState = "CLOSED";
  private abortController: AbortController | null = null;
  private messageListeners: Set<SSEEventHandler> = new Set();
  private stateListeners: Set<SSEStateChangeHandler> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldRun: boolean = false;

  constructor(options: SSEClientOptions = {}) {
    this.url = options.url || `${API_BASE_URL}/v1/stream`;
    this.initialBackoffMs = options.initialBackoffMs || 1000;
    this.maxBackoffMs = options.maxBackoffMs || 30000;
    this.currentBackoffMs = this.initialBackoffMs;

    if (options.onMessage) {
      this.messageListeners.add(options.onMessage);
    }
    if (options.onStateChange) {
      this.stateListeners.add(options.onStateChange);
    }
  }

  public getState(): SSEConnectionState {
    return this.state;
  }

  public onMessage(handler: SSEEventHandler): () => void {
    this.messageListeners.add(handler);
    return () => this.messageListeners.delete(handler);
  }

  public onStateChange(handler: SSEStateChangeHandler): () => void {
    this.stateListeners.add(handler);
    return () => this.stateListeners.delete(handler);
  }

  private setState(newState: SSEConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      for (const listener of this.stateListeners) {
        try {
          listener(newState);
        } catch {
          // Ignore listener exceptions
        }
      }
    }
  }

  public start(): void {
    if (this.shouldRun) return;
    this.shouldRun = true;
    this.connect();
  }

  public stop(): void {
    this.shouldRun = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.setState("CLOSED");
  }

  private async connect(): Promise<void> {
    if (!this.shouldRun) return;

    const token = getStoredToken();
    if (!token) {
      this.setState("CLOSED");
      return;
    }

    this.setState(this.currentBackoffMs > this.initialBackoffMs ? "RECONNECTING" : "CONNECTING");
    this.abortController = new AbortController();

    try {
      const response = await fetch(this.url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        signal: this.abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE stream failed with status ${response.status}`);
      }

      this.setState("OPEN");
      this.currentBackoffMs = this.initialBackoffMs;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (this.shouldRun) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in buffer
        buffer = lines.pop() ?? "";

        let currentEvent = "message";
        let currentData = "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line === "") {
            // End of SSE frame
            if (currentData) {
              this.dispatch({ event: currentEvent, data: currentData });
            }
            currentEvent = "message";
            currentData = "";
            continue;
          }

          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const dataPart = line.slice(5).trim();
            currentData = currentData ? `${currentData}\n${dataPart}` : dataPart;
          }
        }
      }
    } catch {
      // Stream error or aborted
    } finally {
      if (this.shouldRun) {
        this.scheduleReconnect();
      } else {
        this.setState("CLOSED");
      }
    }
  }

  private dispatch(msg: SSEMessage): void {
    for (const listener of this.messageListeners) {
      try {
        listener(msg);
      } catch {
        // Safe dispatch
      }
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return;
    this.setState("RECONNECTING");

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = this.currentBackoffMs;
    // Exponential backoff
    this.currentBackoffMs = Math.min(this.currentBackoffMs * 2, this.maxBackoffMs);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
