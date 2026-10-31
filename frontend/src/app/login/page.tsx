"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sign-in");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground animate-pulse">
        Redirecting to sign in...
      </div>
    </div>
  );
}
