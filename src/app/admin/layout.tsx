import React from "react";
import Link from "next/link";
import {
  GraduationCap,
  Layers,
  BookOpen,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      {/* Top Admin Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#D2D2D7]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/admin/exams"
              className="flex items-center gap-2.5 group"
            >
              <div className="size-8 rounded-lg bg-[#1D1D1F] text-white flex items-center justify-center transition-transform group-hover:scale-105">
                <GraduationCap className="size-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-semibold tracking-tight text-[#1D1D1F] leading-tight">
                  ExamPortal
                </span>
                <span className="text-[11px] font-medium text-[#6E6E73] leading-tight">
                  Admin Console
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-[13px] font-medium">
              <Link
                href="/admin/exams"
                className="px-3 py-1.5 rounded-lg text-[#1D1D1F] hover:bg-[#E8E8ED]/70 transition flex items-center gap-1.5"
              >
                <Layers className="size-4 text-[#0071E3]" />
                <span>Examinations</span>
              </Link>
              <Link
                href="/admin/subjects"
                className="px-3 py-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#E8E8ED]/70 transition flex items-center gap-1.5"
              >
                <BookOpen className="size-4 text-[#6E6E73]" />
                <span>Subjects & Question Bank</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/" target="_blank">
              <Button
                variant="ghost"
                size="sm"
                className="text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#E8E8ED]/60 rounded-full h-8 px-3"
              >
                <ExternalLink className="size-3.5 mr-1" />
                <span>Candidate Portal</span>
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="outline"
                size="sm"
                className="text-[12px] border-[#D2D2D7] bg-white hover:bg-[#E8E8ED]/50 text-[#1D1D1F] rounded-full h-8 px-3 shadow-xs"
              >
                <LogOut className="size-3.5 mr-1 text-[#6E6E73]" />
                <span>Sign Out</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
