import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="py-24 max-w-md mx-auto text-center space-y-4">
      <div className="text-4xl">🔍</div>
      <h2 className="text-xl font-bold text-slate-900">Page Not Found</h2>
      <p className="text-sm text-slate-600">
        The requested resource, machine, or alert incident does not exist.
      </p>
      <div className="pt-2">
        <Link href="/machines">
          <Button className="min-h-[44px]">Return to Machines</Button>
        </Link>
      </div>
    </div>
  );
}
