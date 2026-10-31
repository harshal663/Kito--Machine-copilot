"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error boundary caught error:", error);
  }, [error]);

  return (
    <div className="py-24 max-w-md mx-auto text-center space-y-4">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-xl font-bold text-slate-900">Application Error</h2>
      <p className="text-sm text-slate-600">
        {error.message || "An unexpected error occurred while rendering this page."}
      </p>
      <div className="pt-2">
        <Button onClick={() => reset()} className="min-h-[44px]">
          Try Again
        </Button>
      </div>
    </div>
  );
}
