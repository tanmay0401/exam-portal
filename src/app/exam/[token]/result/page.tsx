"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Award,
  CheckCircle,
  XCircle,
  Circle,
  BarChart3,
  Clock,
  AlertTriangle,
  Loader2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

interface ExamResult {
  attempt_id: string;
  exam_title: string;
  score: number;
  total_correct: number;
  total_incorrect: number;
  total_unanswered: number;
  max_marks: number;
  percentage: number;
  is_auto_submitted: boolean;
  submitted_at: string;
  status: string;
}

function ExamResultContent() {
  const routeParams = useParams();
  const token = (routeParams?.token as string) || "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attempt_id");

  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResult() {
      setLoading(true);
      setError(null);
      try {
        const url = attemptId
          ? `/api/exam-link/${token}/result?attempt_id=${encodeURIComponent(attemptId)}`
          : `/api/exam-link/${token}/result`;

        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to retrieve examination scorecard");
        }

        setResult(data.result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error loading result";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchResult();
    }
  }, [token, attemptId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Ambient Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-tr from-indigo-600/15 via-purple-600/15 to-blue-600/10 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-md shadow-indigo-500/20">
              <div className="size-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="size-4.5 text-indigo-400" />
              </div>
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-none">
                ExamPortal
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Official Examination Scorecard
              </span>
            </div>
          </div>

          <Badge variant="outline" className="border-emerald-500/30 text-emerald-300 text-xs py-1 px-3 bg-emerald-500/10">
            <Sparkles className="size-3 mr-1.5" />
            Graded Automatically
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="size-10 text-indigo-400 animate-spin" />
            <p className="text-slate-400 text-sm">Evaluating answers and computing metrics...</p>
          </div>
        ) : error ? (
          <Card className="border-rose-900/50 bg-rose-950/20 backdrop-blur-xl max-w-lg mx-auto w-full text-center p-6">
            <AlertTriangle className="size-10 text-rose-400 mx-auto mb-3" />
            <CardTitle className="text-lg font-bold text-rose-200">
              Unable to Retrieve Score
            </CardTitle>
            <CardDescription className="text-xs text-rose-300/80 mt-1">
              {error}
            </CardDescription>
            <Button
              onClick={() => router.push(`/exam/${token}`)}
              className="mt-6 bg-slate-800 hover:bg-slate-700 text-white text-xs"
            >
              Return to Examination Link
            </Button>
          </Card>
        ) : result ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="text-center space-y-2">
              <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-xs px-3 py-1">
                Completed & Verified
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {result.exam_title}
              </h1>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <span>Submitted at {new Date(result.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {result.is_auto_submitted && (
                  <>
                    <span>•</span>
                    <span className="text-amber-400 flex items-center gap-1">
                      <Clock className="size-3" />
                      Timer Expiry (Auto-Submitted)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Scorecard Hero Box */}
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-2xl shadow-indigo-500/5">
              <CardHeader className="text-center pb-2 border-b border-slate-800/80">
                <CardDescription className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  Candidate Final Score
                </CardDescription>
                <div className="flex items-baseline justify-center gap-2 pt-2">
                  <span className="text-5xl sm:text-6xl font-black text-white tracking-tight">
                    {result.score}
                  </span>
                  <span className="text-lg sm:text-xl font-medium text-slate-400">
                    / {result.max_marks} marks
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-6 pb-6 space-y-6">
                {/* Accuracy Percentage Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium">Performance Accuracy</span>
                    <span className="font-mono font-bold text-indigo-300">
                      {result.percentage}%
                    </span>
                  </div>
                  <Progress
                    value={Math.max(0, result.percentage)}
                    className="h-2.5 bg-slate-800"
                  />
                </div>

                {/* Score Breakdown Triplets */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-semibold mb-1">
                      <CheckCircle className="size-3.5" />
                      <span>Correct (+4)</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {result.total_correct}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Questions</div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5">
                    <div className="flex items-center justify-center gap-1.5 text-rose-400 text-xs font-semibold mb-1">
                      <XCircle className="size-3.5" />
                      <span>Incorrect (-1)</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {result.total_incorrect}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Questions</div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40">
                    <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs font-semibold mb-1">
                      <Circle className="size-3.5" />
                      <span>Unattempted</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {result.total_unanswered}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Questions</div>
                  </div>
                </div>

                <Separator className="border-slate-800/80" />

                <div className="text-center text-xs text-slate-400 max-w-lg mx-auto">
                  To preserve test security and integrity for ongoing candidate cohorts, detailed answer solutions are withheld. Contact your faculty or examination administrator for further queries.
                </div>
              </CardContent>

              <CardFooter className="pt-2 pb-6 flex justify-center">
                <Link href="/">
                  <Button
                    size="lg"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-8 shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                  >
                    <BarChart3 className="size-4" />
                    <span>Return to Portal Home</span>
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950/40 py-4 text-center text-xs text-slate-500">
        <p>ExamPortal Evaluation System • Secure Official Transcripts</p>
      </footer>
    </div>
  );
}

export default function ExamResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <Loader2 className="size-10 text-indigo-400 animate-spin" />
        </div>
      }
    >
      <ExamResultContent />
    </Suspense>
  );
}
