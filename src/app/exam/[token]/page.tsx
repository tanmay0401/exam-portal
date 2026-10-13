"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Timer,
  Clock,
  Award,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  LogIn,
  UserPlus,
  Loader2,
  ArrowRight,
  LogOut,
  Sparkles,
  HelpCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface ExamInfo {
  id: string;
  title: string;
  duration_minutes: number;
  total_questions: number;
  marks_per_question: number;
  negative_marks: number;
  max_marks: number;
  starts_at: string | null;
  ends_at: string | null;
  is_dry_run: boolean;
}

export default function ExamEntryPage() {
  const routeParams = useParams();
  const token = (routeParams?.token as string) || "";
  const router = useRouter();
  const supabase = createClient();

  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [loadingExam, setLoadingExam] = useState(true);
  const [examError, setExamError] = useState<string | null>(null);

  // Auth states
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [fullNameInput, setFullNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [existingAttemptStatus, setExistingAttemptStatus] = useState<string | null>(null);
  const [checkingAttempt, setCheckingAttempt] = useState(false);

  // 1. Fetch exam info
  useEffect(() => {
    async function fetchExam() {
      setLoadingExam(true);
      setExamError(null);
      try {
        const res = await fetch(`/api/exam-link/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setExamError(data.error || "Unable to load exam details");
          if (data.exam) {
            setExam(data.exam);
          }
        } else {
          setExam(data.exam);
          if (data.authenticated_user) {
            setUserEmail(data.authenticated_user.email);
            setUserId(data.authenticated_user.id);
            if (data.authenticated_user.full_name) {
              setFullNameInput(data.authenticated_user.full_name);
            }
          }
          if (data.existing_attempt) {
            setExistingAttemptStatus(data.existing_attempt.status);
          }
        }
      } catch {
        setExamError("Failed to reach server. Please check your internet connection.");
      } finally {
        setLoadingExam(false);
      }
    }

    fetchExam();
  }, [token]);

  // 2. Check current auth session
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/candidate");
        const authData = await res.json();
        if (authData.authenticated && authData.user) {
          setUserEmail(authData.user.email);
          setUserId(authData.user.id);
          if (authData.user.full_name) {
            setFullNameInput(authData.user.full_name);
          }
          return;
        }
      } catch {
        // Fall back to Supabase client
      }

      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserEmail(data.user.email ?? null);
        setUserId(data.user.id);
      }
    }
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null);
        setUserId(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // 3. Check if user already attempted when exam and user are loaded
  useEffect(() => {
    async function checkExistingAttempt() {
      if (!exam?.id || !userId) return;
      setCheckingAttempt(true);
      try {
        const res = await fetch(`/api/exam-link/${token}`);
        const data = await res.json();
        if (data.existing_attempt) {
          setExistingAttemptStatus(data.existing_attempt.status);
        } else {
          setExistingAttemptStatus(null);
        }
      } catch (e) {
        console.error("Attempt check error", e);
      } finally {
        setCheckingAttempt(false);
      }
    }

    checkExistingAttempt();
  }, [exam?.id, userId, token]);

  // Handle Candidate Login or Registration
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      toast.error("Please fill in both email and password");
      return;
    }

    if (authMode === "register" && !fullNameInput.trim()) {
      toast.error("Please enter your full candidate name");
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authMode,
          email: emailInput,
          password: passwordInput,
          full_name: fullNameInput,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Authentication failed");
      } else {
        toast.success(
          authMode === "register"
            ? "Candidate registration successful and authenticated!"
            : "Signed in successfully"
        );
        setUserEmail(data.user?.email || emailInput);
        setUserId(data.user?.id);
        if (data.user?.full_name) {
          setFullNameInput(data.user.full_name);
        }
        // Re-check exam and attempt status
        try {
          const examRes = await fetch(`/api/exam-link/${token}`);
          const examData = await examRes.json();
          if (examData.existing_attempt) {
            setExistingAttemptStatus(examData.existing_attempt.status);
          }
        } catch {}
      }
    } catch {
      toast.error("An unexpected error occurred during candidate authentication");
    } finally {
      setAuthLoading(false);
    }
  }

  // Handle Sign Out
  async function handleSignOut() {
    try {
      await fetch("/api/auth/candidate", { method: "DELETE" });
      await supabase.auth.signOut();
    } catch {}
    setUserEmail(null);
    setUserId(null);
    setExistingAttemptStatus(null);
    toast.info("Signed out");
  }

  function handleProceedToSystemCheck() {
    router.push(`/exam/${token}/system-check`);
  }

  function handleViewResult() {
    router.push(`/exam/${token}/result`);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-tr from-indigo-600/15 via-purple-600/15 to-blue-600/10 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-md shadow-indigo-500/20">
              <div className="size-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="size-4.5 text-indigo-400" />
              </div>
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-none">
                ExamPortal
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Secure Candidate Assessment Environment
              </span>
            </div>
          </div>

          {userEmail && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <span className="text-xs text-slate-400 block">Candidate</span>
                <span className="text-xs font-semibold text-slate-200 block truncate max-w-[200px]">
                  {userEmail}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-slate-400 hover:text-rose-400 hover:bg-slate-800/50"
              >
                <LogOut className="size-3.5 mr-1.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col justify-center">
        {loadingExam ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="size-10 text-indigo-400 animate-spin" />
            <p className="text-slate-400 text-sm">Verifying examination token...</p>
          </div>
        ) : examError ? (
          <Card className="border-rose-900/50 bg-rose-950/20 backdrop-blur-xl max-w-xl mx-auto w-full">
            <CardHeader className="text-center pb-2">
              <div className="size-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="size-6" />
              </div>
              <CardTitle className="text-rose-200 text-xl font-bold">
                Exam Access Denied
              </CardTitle>
              <CardDescription className="text-rose-300/80">
                {examError}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pt-2">
              <p className="text-xs text-slate-400">
                Please confirm the exam link URL with your assessment administrator or proctor.
              </p>
            </CardContent>
          </Card>
        ) : exam ? (
          <div className="space-y-8">
            {/* Header info */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium backdrop-blur-md">
                <Sparkles className="size-3 text-indigo-400" />
                <span>Official Assessment</span>
                {exam.is_dry_run && (
                  <Badge variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-300 ml-1 border-amber-500/30">
                    Dry Run Mode
                  </Badge>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {exam.title}
              </h1>
              <p className="text-slate-400 text-sm max-w-lg mx-auto">
                Read all instructions carefully before starting. Once you proceed, proctoring security protocols will be engaged.
              </p>
            </div>

            {/* Exam Details Highlights Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Clock className="size-4 text-indigo-400" />
                  <span>Duration</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">
                  {exam.duration_minutes} <span className="text-xs font-normal text-slate-400">mins</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <FileText className="size-4 text-emerald-400" />
                  <span>Questions</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">
                  {exam.total_questions}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Award className="size-4 text-amber-400" />
                  <span>Max Marks</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">
                  {exam.max_marks}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <HelpCircle className="size-4 text-cyan-400" />
                  <span>Marking</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white flex items-baseline gap-1">
                  <span>+{exam.marks_per_question ?? 4}</span>
                  <span className="text-rose-400 text-sm font-semibold">/{exam.negative_marks ? `-${exam.negative_marks}` : "-0"}</span>
                </div>
              </div>
            </div>

            {/* Candidate Authentication or Launch Card */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Instructions Panel */}
              <div className="md:col-span-6 space-y-4">
                <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                      <Shield className="size-4 text-indigo-400" />
                      Candidate Guidelines
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-slate-300 leading-relaxed">
                    <div className="flex items-start gap-2.5">
                      <div className="size-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        1
                      </div>
                      <p>
                        <strong>Continuous Proctoring:</strong> Web camera access and full-screen display are mandatory throughout the test.
                      </p>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="size-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        2
                      </div>
                      <p>
                        <strong>Integrity Violations:</strong> Exiting fullscreen or navigating to other tabs is tracked and logged in the proctor audit report.
                      </p>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="size-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        3
                      </div>
                      <p>
                        <strong>Automatic Submission:</strong> When the countdown reaches zero, all answered responses are immediately locked and submitted.
                      </p>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="size-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        4
                      </div>
                      <p>
                        <strong>Marking Scheme:</strong> Correct answers receive +{exam.marks_per_question ?? 4} marks. Wrong answers incur -{exam.negative_marks ?? 1} marks. Unanswered questions award 0.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Login or Start Action Panel */}
              <div className="md:col-span-6">
                {checkingAttempt ? (
                  <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md p-8 text-center">
                    <Loader2 className="size-8 text-indigo-400 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Verifying attempt history...</p>
                  </Card>
                ) : userEmail ? (
                  /* User already signed in */
                  <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-2xl shadow-indigo-500/5">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                        <CheckCircle className="size-4" />
                        <span>Authenticated</span>
                      </div>
                      <CardTitle className="text-lg text-white">
                        Ready to Proceed
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                        Logged in as <strong className="text-slate-200">{userEmail}</strong>
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {existingAttemptStatus === "graded" || existingAttemptStatus === "submitted" ? (
                        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                          <AlertTriangle className="size-4 text-amber-400" />
                          <AlertTitle className="text-xs font-semibold">
                            Exam Already Completed
                          </AlertTitle>
                          <AlertDescription className="text-xs text-amber-300/90 mt-1">
                            You have already submitted an attempt for this examination. Retakes are not permitted.
                          </AlertDescription>
                        </Alert>
                      ) : existingAttemptStatus === "in_progress" ? (
                        <Alert className="border-indigo-500/30 bg-indigo-500/10 text-indigo-200">
                          <Clock className="size-4 text-indigo-400" />
                          <AlertTitle className="text-xs font-semibold">
                            Attempt In Progress
                          </AlertTitle>
                          <AlertDescription className="text-xs text-indigo-300/90 mt-1">
                            You have an unfinished attempt. You can resume your test with all previously saved answers intact.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs text-slate-300">
                          Next step: System compatibility verification (camera check, browser check, and fullscreen mode).
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="pt-2 flex flex-col gap-2">
                      {existingAttemptStatus === "graded" || existingAttemptStatus === "submitted" ? (
                        <Button
                          onClick={handleViewResult}
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium"
                        >
                          <Award className="size-4 mr-2" />
                          View My Score Card
                        </Button>
                      ) : (
                        <Button
                          onClick={handleProceedToSystemCheck}
                          size="lg"
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all"
                        >
                          <span>{existingAttemptStatus === "in_progress" ? "Resume Exam" : "Start System Check"}</span>
                          <ArrowRight className="size-4 ml-2" />
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ) : (
                  /* Student Login / Register Form */
                  <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-2xl">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base text-white flex items-center gap-2">
                          {authMode === "register" ? (
                            <UserPlus className="size-4 text-indigo-400" />
                          ) : (
                            <LogIn className="size-4 text-indigo-400" />
                          )}
                          <span>Candidate Access</span>
                        </CardTitle>
                      </div>
                      <CardDescription className="text-slate-400 text-xs">
                        {authMode === "register"
                          ? "Register as an official candidate for this assessment"
                          : "Enter your registered student credentials to unlock this assessment"}
                      </CardDescription>

                      {/* Tabs */}
                      <Tabs
                        value={authMode}
                        onValueChange={(val) => setAuthMode(val as "login" | "register")}
                        className="w-full pt-2"
                      >
                        <TabsList className="grid grid-cols-2 bg-slate-950/80 border border-slate-800">
                          <TabsTrigger value="login" className="text-xs data-active:bg-indigo-600 data-active:text-white">
                            Sign In
                          </TabsTrigger>
                          <TabsTrigger value="register" className="text-xs data-active:bg-indigo-600 data-active:text-white">
                            Register Candidate
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </CardHeader>

                    <form onSubmit={handleAuth}>
                      <CardContent className="space-y-3.5">
                        {authMode === "register" && (
                          <div className="space-y-1.5">
                            <Label htmlFor="fullname" className="text-xs text-slate-300">
                              Full Candidate Name
                            </Label>
                            <Input
                              id="fullname"
                              type="text"
                              placeholder="e.g. Jane Doe"
                              value={fullNameInput}
                              onChange={(e) => setFullNameInput(e.target.value)}
                              required={authMode === "register"}
                              className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500"
                            />
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label htmlFor="email" className="text-xs text-slate-300">
                            Email Address
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="student@example.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            required
                            className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="password" className="text-xs text-slate-300">
                            Password
                          </Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            required
                            className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500"
                          />
                        </div>
                      </CardContent>

                      <CardFooter className="pt-2">
                        <Button
                          type="submit"
                          disabled={authLoading}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-500/20"
                        >
                          {authLoading ? (
                            <>
                              <Loader2 className="size-4 mr-2 animate-spin" />
                              Authenticating...
                            </>
                          ) : authMode === "register" ? (
                            <>
                              <UserPlus className="size-4 mr-2" />
                              Register & Continue
                            </>
                          ) : (
                            <>
                              <LogIn className="size-4 mr-2" />
                              Sign In & Continue
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </form>
                  </Card>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950/40 py-4 text-center text-xs text-slate-500">
        <p>ExamPortal Proctoring Engine • All rights reserved</p>
      </footer>
    </div>
  );
}
