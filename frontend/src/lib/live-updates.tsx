"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SSEClient, type SSEConnectionState, type SSEMessage } from "./sse";
import { queryKeys } from "./query-keys";
import { getStoredToken } from "./auth";

interface LiveUpdatesContextValue {
  connectionState: SSEConnectionState;
  reconnect: () => void;
}

const LiveUpdatesContext = createContext<LiveUpdatesContextValue>({
  connectionState: "CLOSED",
  reconnect: () => {},
});

export function LiveUpdatesProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<SSEConnectionState>("CLOSED");

  const sseClient = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new SSEClient();
  }, []);

  useEffect(() => {
    if (!sseClient) return;

    const token = getStoredToken();
    if (!token) {
      setConnectionState("CLOSED");
      return;
    }

    const unsubState = sseClient.onStateChange((state) => {
      setConnectionState(state);
    });

    const unsubMsg = sseClient.onMessage((msg: SSEMessage) => {
      try {
        if (msg.event === "event.updated") {
          const payload = JSON.parse(msg.data) as {
            event_id?: string;
            machine_id?: string;
            status?: string;
          };
          // Invalidate alerts list and detail
          void queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
          if (payload.event_id) {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.events.detail(payload.event_id),
            });
          }
          // Machine open alerts count changes when events update
          void queryClient.invalidateQueries({ queryKey: queryKeys.machines.all });
          if (payload.machine_id) {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.machines.detail(payload.machine_id),
            });
          }
        } else if (msg.event === "machine.updated") {
          const payload = JSON.parse(msg.data) as {
            machine_id?: string;
            presence?: string;
          };
          void queryClient.invalidateQueries({ queryKey: queryKeys.machines.all });
          if (payload.machine_id) {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.machines.detail(payload.machine_id),
            });
          }
        }
      } catch {
        // Frame parse error
      }
    });

    sseClient.start();

    return () => {
      unsubMsg();
      unsubState();
      sseClient.stop();
    };
  }, [sseClient, queryClient]);

  const value = useMemo(
    () => ({
      connectionState,
      reconnect: () => {
        sseClient?.stop();
        sseClient?.start();
      },
    }),
    [connectionState, sseClient]
  );

  return <LiveUpdatesContext.Provider value={value}>{children}</LiveUpdatesContext.Provider>;
}

export function useLiveUpdates(): LiveUpdatesContextValue {
  return useContext(LiveUpdatesContext);
}
