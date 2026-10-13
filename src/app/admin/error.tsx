"use client";

import React, { useEffect } from "react";
import { AlertCircle, RefreshCw, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="size-14 rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 flex items-center justify-center mb-4">
        <AlertCircle className="size-7 text-[#FF3B30]" />
      </div>
      <h2 className="text-xl font-semibold text-[#1D1D1F] tracking-tight">
        Something went wrong
      </h2>
      <p className="text-sm text-[#6E6E73] mt-1.5 max-w-md leading-relaxed">
        {error.message || "An unexpected error occurred while loading this administrative section."}
      </p>
      <div className="flex items-center gap-3 mt-6">
        <Button
          onClick={() => reset()}
          size="sm"
          className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs rounded-xl shadow-xs h-9 px-4"
        >
          <RefreshCw className="size-3.5 mr-1.5" />
          <span>Try Again</span>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] text-xs rounded-xl h-9"
        >
          <Link href="/admin">
            <ChevronLeft className="size-3.5 mr-1" />
            <span>Admin Home</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
