"use client";

import React from "react";
import { useLiveUpdates } from "@/lib/live-updates";

export function ReconnectingBanner() {
  const { connectionState, reconnect } = useLiveUpdates();

  if (connectionState !== "RECONNECTING") {
    return null;
  }

  return (
    <div className="w-full bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium flex items-center justify-center space-x-3 shadow-inner">
      <span className="inline-block animate-spin mr-1">🔄</span>
      <span>Live updates disconnected. Reconnecting to telemetry stream...</span>
      <button
        onClick={reconnect}
        className="ml-2 underline font-semibold hover:text-amber-900 min-h-[44px] px-2"
      >
        Retry now
      </button>
    </div>
  );
}
