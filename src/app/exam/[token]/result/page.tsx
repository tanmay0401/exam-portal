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
  CheckCircle,
  XCircle,
  Circle,
  BarChart3,
  Clock,
  AlertTriangle,
  Loader2,
  Sparkles,
  ShieldCheck,
  User,
  BookOpen,
  RefreshCw,
} from "lucide-react";

interface ExamResult {
  attempt_id: string;
  exam_title: string;
  subject_name?: string;
  student_name?: string;
  student_email?: string;
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

  const fetchResult = async () => {
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

      const scorecard = data.result || data;
      if (!scorecard || typeof scorecard.score === "undefined") {
        throw new Error("Invalid scorecard format received from server");
      }

      setResult(scorecard);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading result";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchResult();
    }
  }, [token, attemptId]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#D2D2D7]/80 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center">
              <ShieldCheck className="size-5 text-[#0071E3]" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-[#1D1D1F] block leading-none">
                ExamPortal
              </span>
              <span className="text-[11px] text-[#6E6E73] block mt-0.5">
                Official Examination Scorecard
              </span>
            </div>
          </div>

          <Badge variant="outline" className="border-[#34C759]/30 text-[#1E7E34] text-xs py-1 px-3 bg-[#34C759]/10 rounded-full font-medium">
            <Sparkles className="size-3 mr-1.5" />
            Graded Automatically
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="size-10 text-[#0071E3] animate-spin" />
            <p className="text-[#6E6E73] text-sm">Evaluating answers and computing metrics...</p>
          </div>
        ) : error ? (
          <Card className="border-[#FF3B30]/30 bg-white shadow-sm max-w-lg mx-auto w-full text-center p-8 rounded-2xl">
            <div className="size-12 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="size-6 text-[#FF3B30]" />
            </div>
            <CardTitle className="text-lg font-semibold text-[#1D1D1F]">
              Unable to Retrieve Score
            </CardTitle>
            <CardDescription className="text-xs text-[#6E6E73] mt-2">
              {error}
            </CardDescription>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                onClick={fetchResult}
                variant="outline"
                className="border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs rounded-xl"
              >
                <RefreshCw className="size-3.5 mr-1.5" />
                Try Again
              </Button>
              <Button
                onClick={() => router.push(`/exam/${token}`)}
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs rounded-xl"
              >
                Return to Examination Link
              </Button>
            </div>
          </Card>
        ) : result ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="text-center space-y-2.5">
              <div className="flex items-center justify-center gap-2">
                <Badge className="bg-[#34C759]/10 text-[#1E7E34] border border-[#34C759]/30 text-xs px-3 py-1 rounded-full font-medium">
                  Completed & Verified
                </Badge>
                {result.subject_name && (
                  <Badge variant="outline" className="border-[#0071E3]/25 text-[#0071E3] text-xs px-3 py-1 bg-[#0071E3]/10 rounded-full font-medium flex items-center gap-1">
                    <BookOpen className="size-3" />
                    {result.subject_name}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] tracking-tight">
                {result.exam_title}
              </h1>

              {/* Candidate Info Pill */}
              {(result.student_name || result.student_email) && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#D2D2D7] text-xs text-[#6E6E73] shadow-sm">
                  <User className="size-3.5 text-[#0071E3]" />
                  <span className="font-medium text-[#1D1D1F]">{result.student_name}</span>
                  {result.student_email && (
                    <span className="text-[#6E6E73]">({result.student_email})</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-xs text-[#6E6E73]">
                <span>Submitted at {new Date(result.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {result.is_auto_submitted && (
                  <>
                    <span>•</span>
                    <span className="text-[#FF9500] font-medium flex items-center gap-1">
                      <Clock className="size-3" />
                      Timer Expiry (Auto-Submitted)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Scorecard Hero Box */}
            <Card className="border border-[#D2D2D7] bg-white rounded-2xl shadow-sm overflow-hidden">
              <CardHeader className="text-center pb-4 pt-8 border-b border-[#D2D2D7]/60 bg-[#F5F5F7]/40">
                <CardDescription className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wider">
                  Candidate Final Score
                </CardDescription>
                <div className="flex items-baseline justify-center gap-2 pt-2">
                  <span className="text-5xl sm:text-6xl font-bold text-[#1D1D1F] tracking-tight font-mono">
                    {result.score}
                  </span>
                  <span className="text-lg sm:text-xl font-normal text-[#6E6E73]">
                    / {result.max_marks} marks
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-6 pb-6 space-y-6">
                {/* Accuracy Percentage Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#1D1D1F] font-medium">Performance Accuracy</span>
                    <span className="font-mono font-bold text-[#0071E3]">
                      {result.percentage}%
                    </span>
                  </div>
                  <Progress
                    value={Math.max(0, result.percentage)}
                    className="h-2.5 bg-[#E8E8ED] [&>div]:bg-[#0071E3]"
                  />
                </div>

                {/* Score Breakdown Triplets */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-4 rounded-xl border border-[#34C759]/25 bg-[#34C759]/5">
                    <div className="flex items-center justify-center gap-1.5 text-[#1E7E34] text-xs font-semibold mb-1">
                      <CheckCircle className="size-3.5" />
                      <span>Correct (+4)</span>
                    </div>
                    <div className="text-2xl font-bold text-[#1D1D1F] font-mono">
                      {result.total_correct}
                    </div>
                    <div className="text-[11px] text-[#6E6E73] mt-0.5">Questions</div>
                  </div>

                  <div className="p-4 rounded-xl border border-[#FF3B30]/25 bg-[#FF3B30]/5">
                    <div className="flex items-center justify-center gap-1.5 text-[#D70015] text-xs font-semibold mb-1">
                      <XCircle className="size-3.5" />
                      <span>Incorrect (-1)</span>
                    </div>
                    <div className="text-2xl font-bold text-[#1D1D1F] font-mono">
                      {result.total_incorrect}
                    </div>
                    <div className="text-[11px] text-[#6E6E73] mt-0.5">Questions</div>
                  </div>

                  <div className="p-4 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]">
                    <div className="flex items-center justify-center gap-1.5 text-[#6E6E73] text-xs font-semibold mb-1">
                      <Circle className="size-3.5" />
                      <span>Unattempted</span>
                    </div>
                    <div className="text-2xl font-bold text-[#1D1D1F] font-mono">
                      {result.total_unanswered}
                    </div>
                    <div className="text-[11px] text-[#6E6E73] mt-0.5">Questions</div>
                  </div>
                </div>

                <Separator className="bg-[#D2D2D7]/80" />

                <div className="text-center text-xs text-[#6E6E73] max-w-lg mx-auto leading-relaxed">
                  To preserve test security and integrity for ongoing candidate cohorts, detailed answer solutions are withheld. Contact your faculty or examination administrator for further queries.
                </div>
              </CardContent>

              <CardFooter className="pt-2 pb-6 flex justify-center">
                <Link href="/">
                  <Button
                    size="lg"
                    className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium px-8 rounded-xl shadow-sm flex items-center gap-2 h-11"
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
      <footer className="border-t border-[#D2D2D7]/80 bg-white py-4 text-center text-xs text-[#6E6E73]">
        <p>ExamPortal Evaluation System • Secure Official Transcripts</p>
      </footer>
    </div>
  );
}

export default function ExamResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center">
          <Loader2 className="size-10 text-[#0071E3] animate-spin" />
        </div>
      }
    >
      <ExamResultContent />
    </Suspense>
  );
}
