import Link from "next/link";
import {
  Shuffle,
  Timer,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  GraduationCap,
  Sparkles,
  Lock,
  BarChart3,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const features = [
    {
      title: "Randomized Papers",
      description:
        "Automated multi-batch question distribution ensures unique yet balanced question sets for every examinee, effectively preventing malpractice.",
      icon: Shuffle,
      gradient: "from-blue-500/20 to-cyan-500/20",
      iconColor: "text-blue-400",
      badge: "Anti-Cheating",
    },
    {
      title: "Timed Exams",
      description:
        "Precision countdown timers with automatic submission upon deadline expiry. Built-in network tolerance ensures no progress is lost.",
      icon: Timer,
      gradient: "from-amber-500/20 to-orange-500/20",
      iconColor: "text-amber-400",
      badge: "Precision Timing",
    },
    {
      title: "Auto-Grading",
      description:
        "Instant score evaluation with comprehensive analytics, accuracy breakdown, and negative marking support calculated dynamically upon submission.",
      icon: CheckCircle2,
      gradient: "from-emerald-500/20 to-green-500/20",
      iconColor: "text-emerald-400",
      badge: "Instant Insights",
    },
    {
      title: "Live Proctoring",
      description:
        "Proctor logging tracking tab switches, fullscreen departures, and suspicious activity logs to guarantee assessment credibility.",
      icon: ShieldCheck,
      gradient: "from-purple-500/20 to-pink-500/20",
      iconColor: "text-purple-400",
      badge: "Integrity",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Glows / Ambient Mesh */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-tr from-indigo-600/20 via-purple-600/20 to-blue-600/10 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 left-10 h-[300px] w-[350px] rounded-full bg-purple-600/10 blur-[100px]" />

      {/* Grid Pattern overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Navigation Header */}
      <header className="relative z-10 border-b border-slate-800/60 bg-slate-950/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight group">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition">
              <div className="size-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <GraduationCap className="size-5 text-indigo-400 group-hover:scale-110 transition" />
              </div>
            </div>
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent text-xl font-extrabold tracking-tight">
              ExamPortal
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/login?role=student">
              <Button
                variant="ghost"
                className="text-slate-300 hover:text-white hover:bg-slate-800/60 text-sm"
              >
                Student Access
              </Button>
            </Link>
            <Link href="/login?role=admin">
              <Button
                className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 text-sm"
              >
                Admin Portal
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero & Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-7xl mx-auto px-6 py-16 sm:py-24">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium backdrop-blur-md">
            <Sparkles className="size-3.5 text-indigo-400" />
            <span>Next-Generation Evaluation Infrastructure</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
            Empower Examinations with{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              ExamPortal
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Secure, scalable online examinations. Seamless assessment authoring, algorithmic question randomization, and robust proctoring for institutions and educators.
          </p>

          {/* CTA Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login?role=student" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-7 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium shadow-xl shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
              >
                <GraduationCap className="size-5" />
                <span>Take an Exam</span>
                <ArrowRight className="size-4 ml-1" />
              </Button>
            </Link>

            <Link href="/login?role=admin" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-12 px-7 rounded-xl border-slate-700/80 bg-slate-900/60 hover:bg-slate-800/80 text-slate-200 hover:text-white backdrop-blur-md transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
              >
                <Lock className="size-4 text-indigo-400" />
                <span>Admin Login</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-20 w-full">
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Built for Academic & Enterprise Rigor
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Everything needed to conduct high-stakes assessments securely at scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="group relative rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-xl transition-all duration-300 hover:border-slate-700 hover:bg-slate-900/70 hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`size-12 rounded-xl bg-gradient-to-br ${item.gradient} border border-slate-700/50 flex items-center justify-center transition-transform group-hover:scale-105`}>
                        <Icon className={`size-6 ${item.iconColor}`} />
                      </div>
                      <span className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60">
                        {item.badge}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                      {item.title}
                    </h3>

                    <p className="text-sm text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center text-xs font-medium text-slate-500 group-hover:text-indigo-400 transition-colors">
                    Enterprise Grade &rarr;
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Secondary Trust / Stats Banner */}
        <div className="mt-16 w-full max-w-4xl mx-auto rounded-2xl border border-slate-800/60 bg-slate-900/30 backdrop-blur-md p-6 sm:p-8 flex flex-wrap items-center justify-around gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">99.9%</div>
            <div className="text-xs sm:text-sm text-slate-400 mt-1">Uptime SLA</div>
          </div>
          <div className="h-8 w-px bg-slate-800 hidden sm:block" />
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">0s Latency</div>
            <div className="text-xs sm:text-sm text-slate-400 mt-1">Instant Auto-Grading</div>
          </div>
          <div className="h-8 w-px bg-slate-800 hidden sm:block" />
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">100%</div>
            <div className="text-xs sm:text-sm text-slate-400 mt-1">Tamper Resistant</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950/60 backdrop-blur-md py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} ExamPortal. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/login?role=student" className="hover:text-slate-300 transition">
              Student Login
            </Link>
            <Link href="/login?role=admin" className="hover:text-slate-300 transition">
              Administrator Console
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
