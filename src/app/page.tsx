"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shuffle,
  Timer,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  GraduationCap,
  Lock,
  Search,
  ExternalLink,
  Laptop,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function HomePage() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");

  const handleLaunchByToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    let cleanToken = tokenInput.trim();
    // Support pasting full URL or token
    if (cleanToken.includes("/exam/")) {
      const match = cleanToken.match(/\/exam\/([^/?#]+)/);
      if (match && match[1]) cleanToken = match[1];
    }
    router.push(`/exam/${cleanToken}`);
  };

  const features = [
    {
      title: "Randomized Multi-Batch Papers",
      description:
        "Balanced question distribution across parallel cohorts prevents collaboration while preserving statistical fairness.",
      icon: Shuffle,
      badge: "Integrity",
    },
    {
      title: "Precision Timed Execution",
      description:
        "Fail-closed countdown timers with automatic submission upon deadline expiry. Real-time background sync guarantees zero data loss.",
      icon: Timer,
      badge: "Real-Time",
    },
    {
      title: "Live Computer Vision Proctoring",
      description:
        "Client-side MediaPipe analysis monitors candidate face presence, head-pose deviations, gaze angles, and fullscreen continuity.",
      icon: ShieldCheck,
      badge: "Proctoring",
    },
    {
      title: "Instant Evaluator & Audit Ledger",
      description:
        "Immediate score calculation with negative marking formula (+4 / -1) and comprehensive timeline audit logs for institution reviews.",
      icon: CheckCircle2,
      badge: "Automated",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#D2D2D7]/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-lg bg-[#1D1D1F] text-white flex items-center justify-center transition-transform group-hover:scale-105">
              <GraduationCap className="size-4.5" />
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
              ExamPortal
            </span>
          </Link>

          <nav className="flex items-center gap-2.5">
            <Link href="/login?role=student">
              <Button
                variant="ghost"
                size="sm"
                className="text-[13px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#E8E8ED]/60 rounded-full px-4 h-8"
              >
                Student Sign In
              </Button>
            </Link>
            <Link href="/login?role=admin">
              <Button
                size="sm"
                className="text-[13px] font-medium bg-[#1D1D1F] hover:bg-[#333336] text-white rounded-full px-4 h-8 shadow-xs"
              >
                Admin Console
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-6xl w-full mx-auto px-6 py-16 sm:py-20 space-y-16">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#D2D2D7] text-[#6E6E73] text-[12px] font-medium shadow-xs">
            <span className="size-1.5 rounded-full bg-[#0071E3]" />
            <span>Academic & Institutional Assessment Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-[#1D1D1F] leading-[1.1]">
            Examinations built for precision, integrity, and focus.
          </h1>

          <p className="text-[17px] sm:text-[19px] text-[#6E6E73] max-w-2xl mx-auto font-normal leading-relaxed">
            A calm, distraction-free examination experience for candidates, backed by real-time computer vision proctoring and automated paper generation.
          </p>

          {/* Primary Action Row */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login?role=student">
              <Button
                size="lg"
                className="h-11 px-6 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center gap-2"
              >
                <span>Candidate Portal</span>
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/login?role=admin">
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-6 rounded-full bg-white border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#E8E8ED]/50 text-[14px] font-medium shadow-xs transition-all"
              >
                <Lock className="size-3.5 mr-1.5 text-[#6E6E73]" />
                <span>Admin Login</span>
              </Button>
            </Link>
          </div>

          {/* Direct Token Launch Card */}
          <div className="pt-4 max-w-md mx-auto">
            <form
              onSubmit={handleLaunchByToken}
              className="flex items-center gap-2 p-1.5 bg-white border border-[#D2D2D7] rounded-full shadow-xs focus-within:border-[#0071E3] focus-within:ring-2 focus-within:ring-[#0071E3]/20 transition-all"
            >
              <div className="pl-3 text-[#6E6E73]">
                <Search className="size-4" />
              </div>
              <input
                type="text"
                placeholder="Enter exam link token to launch..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="flex-1 bg-transparent text-[13px] text-[#1D1D1F] placeholder:text-[#86868B] outline-none px-1"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!tokenInput.trim()}
                className="h-8 px-4 rounded-full bg-[#1D1D1F] hover:bg-[#333336] text-white text-[12px] font-medium transition"
              >
                Launch
              </Button>
            </form>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="w-full space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
              Designed for serious examinations
            </h2>
            <p className="text-[14px] text-[#6E6E73]">
              Every component engineered to ensure credibility, security, and a fair candidate experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs hover:border-[#B0B0B8] hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="size-10 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-[#1D1D1F]">
                        <Icon className="size-5 text-[#0071E3]" />
                      </div>
                      <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#6E6E73] border border-[#E5E5EA]">
                        {item.badge}
                      </span>
                    </div>

                    <h3 className="text-[16px] font-semibold text-[#1D1D1F] tracking-tight">
                      {item.title}
                    </h3>

                    <p className="text-[13px] text-[#6E6E73] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Technical Principles Strip */}
        <div className="w-full bg-white border border-[#D2D2D7] rounded-2xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#1D1D1F]">
              <Check className="size-4 text-[#34C759]" />
              <span>Edge Computer Vision</span>
            </div>
            <p className="text-[12px] text-[#6E6E73] leading-relaxed">
              Real-time MediaPipe face presence, multi-face alerts, and head-pose monitoring without server bandwidth bottlenecks.
            </p>
          </div>

          <div className="space-y-1 md:border-l md:border-[#E5E5EA] md:pl-6">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#1D1D1F]">
              <Check className="size-4 text-[#34C759]" />
              <span>Full Device Compatibility</span>
            </div>
            <p className="text-[12px] text-[#6E6E73] leading-relaxed">
              Tested on desktop Chrome, iPadOS Safari/Chrome, and laptops with responsive Quizrr-style question canvas.
            </p>
          </div>

          <div className="space-y-1 md:border-l md:border-[#E5E5EA] md:pl-6">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#1D1D1F]">
              <Check className="size-4 text-[#34C759]" />
              <span>Fail-Closed Reliability</span>
            </div>
            <p className="text-[12px] text-[#6E6E73] leading-relaxed">
              Camera disconnections instantly lock answering while the timer runs, maintaining absolute assessment credibility.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#D2D2D7] py-8 text-[12px] text-[#6E6E73]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} ExamPortal. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/login?role=student" className="hover:text-[#1D1D1F] transition">
              Candidate Login
            </Link>
            <Link href="/login?role=admin" className="hover:text-[#1D1D1F] transition">
              Administrator Console
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
