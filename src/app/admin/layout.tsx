import React from "react";
import Link from "next/link";
import {
  GraduationCap,
  Layers,
  FileQuestion,
  Users,
  Settings,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Admin Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/admin/exams"
              className="flex items-center gap-2.5 font-bold text-lg tracking-tight group"
            >
              <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition">
                <div className="size-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <GraduationCap className="size-5 text-indigo-400 group-hover:scale-110 transition" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent text-lg font-extrabold tracking-tight">
                  ExamPortal
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-400 -mt-1">
                  Admin Console
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              <Link
                href="/admin/exams"
                className="px-3 py-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800/60 transition flex items-center gap-2"
              >
                <Layers className="size-4 text-indigo-400" />
                <span>Exams</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" target="_blank">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800"
              >
                <ExternalLink className="size-3.5 mr-1.5" />
                <span>Portal Home</span>
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300"
              >
                <LogOut className="size-3.5 mr-1.5 text-slate-400" />
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
