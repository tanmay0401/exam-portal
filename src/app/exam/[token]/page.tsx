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
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      {/* Top Header */}
      <header className="border-b border-[#D2D2D7]/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#0071E3] text-white flex items-center justify-center shadow-sm">
              <Shield className="size-5" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-[#1D1D1F] block leading-none">
                ExamPortal
              </span>
              <span className="text-[11px] text-[#6E6E73] block mt-0.5 font-medium">
                Secure Candidate Assessment Environment
              </span>
            </div>
          </div>

          {userEmail && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <span className="text-xs text-[#6E6E73] block">Candidate</span>
                <span className="text-xs font-semibold text-[#1D1D1F] block truncate max-w-[200px]">
                  {userEmail}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="border-[#D2D2D7] text-[#6E6E73] hover:text-[#FF3B30] hover:bg-white text-xs h-8"
              >
                <LogOut className="size-3.5 mr-1.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col justify-center">
        {loadingExam ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="size-9 text-[#0071E3] animate-spin" />
            <p className="text-[#6E6E73] text-sm font-medium">Verifying examination token...</p>
          </div>
        ) : examError ? (
          <Card className="border-[#FF3B30]/30 bg-white shadow-sm max-w-xl mx-auto w-full rounded-2xl overflow-hidden">
            <CardHeader className="text-center pb-2 pt-6">
              <div className="size-12 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="size-6" />
              </div>
              <CardTitle className="text-[#1D1D1F] text-xl font-bold">
                Exam Access Denied
              </CardTitle>
              <CardDescription className="text-[#6E6E73] text-sm mt-1">
                {examError}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pb-6">
              <p className="text-xs text-[#86868B]">
                Please confirm the examination link with your proctor or administrator.
              </p>
            </CardContent>
          </Card>
        ) : exam ? (
          <div className="space-y-8">
            {/* Header info */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#D2D2D7] bg-white text-[#1D1D1F] text-xs font-medium shadow-sm">
                <Sparkles className="size-3 text-[#0071E3]" />
                <span>Official Assessment</span>
                {exam.is_dry_run && (
                  <Badge variant="secondary" className="text-[10px] bg-[#FF9500]/15 text-[#B25E00] border border-[#FF9500]/30 font-semibold ml-1">
                    Dry Run Mode
                  </Badge>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold text-[#1D1D1F] tracking-tight">
                {exam.title}
              </h1>
              <p className="text-[#6E6E73] text-sm max-w-lg mx-auto">
                Read all instructions carefully before starting. Once you proceed, proctoring security protocols will be engaged.
              </p>
            </div>

            {/* Exam Details Highlights Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4.5 rounded-2xl border border-[#D2D2D7] bg-white shadow-sm">
                <div className="flex items-center gap-1.5 text-[#6E6E73] text-xs mb-1 font-medium">
                  <Clock className="size-4 text-[#0071E3]" />
                  <span>Duration</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#1D1D1F]">
                  {exam.duration_minutes} <span className="text-xs font-normal text-[#6E6E73]">mins</span>
                </div>
              </div>

              <div className="p-4.5 rounded-2xl border border-[#D2D2D7] bg-white shadow-sm">
                <div className="flex items-center gap-1.5 text-[#6E6E73] text-xs mb-1 font-medium">
                  <FileText className="size-4 text-[#34C759]" />
                  <span>Questions</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#1D1D1F]">
                  {exam.total_questions}
                </div>
              </div>

              <div className="p-4.5 rounded-2xl border border-[#D2D2D7] bg-white shadow-sm">
                <div className="flex items-center gap-1.5 text-[#6E6E73] text-xs mb-1 font-medium">
                  <Award className="size-4 text-[#FF9500]" />
                  <span>Max Marks</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#1D1D1F]">
                  {exam.max_marks}
                </div>
              </div>

              <div className="p-4.5 rounded-2xl border border-[#D2D2D7] bg-white shadow-sm">
                <div className="flex items-center gap-1.5 text-[#6E6E73] text-xs mb-1 font-medium">
                  <HelpCircle className="size-4 text-[#0071E3]" />
                  <span>Marking</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#1D1D1F] flex items-baseline gap-1">
                  <span>+{exam.marks_per_question ?? 4}</span>
                  <span className="text-[#FF3B30] text-sm font-semibold">/{exam.negative_marks ? `-${exam.negative_marks}` : "-0"}</span>
                </div>
              </div>
            </div>

            {/* Candidate Authentication or Launch Card */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Instructions Panel */}
              <div className="md:col-span-6 space-y-4">
                <Card className="border-[#D2D2D7] bg-white shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-[#D2D2D7]/80 bg-[#F5F5F7]/40">
                    <CardTitle className="text-sm font-semibold text-[#1D1D1F] flex items-center gap-2">
                      <Shield className="size-4 text-[#0071E3]" />
                      Candidate Guidelines
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3.5 pt-4 text-xs text-[#424245] leading-relaxed">
                    <div className="flex items-start gap-3">
                      <div className="size-5 rounded-full bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        1
                      </div>
                      <p>
                        <strong className="text-[#1D1D1F]">Continuous Proctoring:</strong> Web camera access and full-screen display are mandatory throughout the test.
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="size-5 rounded-full bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        2
                      </div>
                      <p>
                        <strong className="text-[#1D1D1F]">Integrity Violations:</strong> Exiting fullscreen or navigating to other tabs is tracked and logged in the proctor audit report.
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="size-5 rounded-full bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        3
                      </div>
                      <p>
                        <strong className="text-[#1D1D1F]">Automatic Submission:</strong> When the countdown reaches zero, all answered responses are immediately locked and submitted.
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="size-5 rounded-full bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        4
                      </div>
                      <p>
                        <strong className="text-[#1D1D1F]">Marking Scheme:</strong> Correct answers receive +{exam.marks_per_question ?? 4} marks. Wrong answers incur -{exam.negative_marks ?? 1} marks. Unanswered questions award 0.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Login or Start Action Panel */}
              <div className="md:col-span-6">
                {checkingAttempt ? (
                  <Card className="border-[#D2D2D7] bg-white shadow-sm rounded-2xl p-8 text-center">
                    <Loader2 className="size-8 text-[#0071E3] animate-spin mx-auto mb-2" />
                    <p className="text-xs text-[#6E6E73] font-medium">Verifying attempt history...</p>
                  </Card>
                ) : userEmail ? (
                  /* User already signed in */
                  <Card className="border-[#D2D2D7] bg-white shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="pb-3 border-b border-[#D2D2D7]/80 bg-[#F5F5F7]/40">
                      <div className="flex items-center gap-1.5 text-[#1E7E34] text-xs font-semibold">
                        <CheckCircle className="size-4 text-[#34C759]" />
                        <span>Authenticated Candidate</span>
                      </div>
                      <CardTitle className="text-base font-bold text-[#1D1D1F] mt-1">
                        Ready to Proceed
                      </CardTitle>
                      <CardDescription className="text-[#6E6E73] text-xs">
                        Logged in as <strong className="text-[#1D1D1F] font-semibold">{userEmail}</strong>
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-4">
                      {existingAttemptStatus === "graded" || existingAttemptStatus === "submitted" ? (
                        <Alert className="border-[#FF9500]/30 bg-[#FF9500]/10 text-[#B25E00]">
                          <AlertTriangle className="size-4 text-[#FF9500]" />
                          <AlertTitle className="text-xs font-semibold">
                            Exam Already Completed
                          </AlertTitle>
                          <AlertDescription className="text-xs text-[#B25E00] mt-1">
                            You have already submitted an attempt for this examination. Retakes are not permitted.
                          </AlertDescription>
                        </Alert>
                      ) : existingAttemptStatus === "in_progress" ? (
                        <Alert className="border-[#0071E3]/30 bg-[#0071E3]/10 text-[#0071E3]">
                          <Clock className="size-4 text-[#0071E3]" />
                          <AlertTitle className="text-xs font-semibold">
                            Attempt In Progress
                          </AlertTitle>
                          <AlertDescription className="text-xs text-[#0071E3] mt-1">
                            You have an unfinished attempt. You can resume your test with all previously saved answers intact.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-xs text-[#424245]">
                          Next step: System compatibility verification (camera check, browser check, and fullscreen mode).
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="pt-2 pb-6 px-6 flex flex-col gap-2">
                      {existingAttemptStatus === "graded" || existingAttemptStatus === "submitted" ? (
                        <Button
                          onClick={handleViewResult}
                          className="w-full bg-[#1D1D1F] hover:bg-black text-white font-medium rounded-xl h-10 shadow-sm"
                        >
                          <Award className="size-4 mr-2" />
                          View My Score Card
                        </Button>
                      ) : (
                        <Button
                          onClick={handleProceedToSystemCheck}
                          size="lg"
                          className="w-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold rounded-xl h-11 shadow-sm transition-all"
                        >
                          <span>{existingAttemptStatus === "in_progress" ? "Resume Exam" : "Start System Check"}</span>
                          <ArrowRight className="size-4 ml-2" />
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ) : (
                  /* Student Login / Register Form */
                  <Card className="border-[#D2D2D7] bg-white shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="pb-3 border-b border-[#D2D2D7]/80 bg-[#F5F5F7]/40">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-bold text-[#1D1D1F] flex items-center gap-2">
                          {authMode === "register" ? (
                            <UserPlus className="size-4 text-[#0071E3]" />
                          ) : (
                            <LogIn className="size-4 text-[#0071E3]" />
                          )}
                          <span>Candidate Access</span>
                        </CardTitle>
                      </div>
                      <CardDescription className="text-[#6E6E73] text-xs mt-1">
                        {authMode === "register"
                          ? "Register as an official candidate for this assessment"
                          : "Enter your registered student credentials to unlock this assessment"}
                      </CardDescription>

                      {/* Tabs */}
                      <Tabs
                        value={authMode}
                        onValueChange={(val) => setAuthMode(val as "login" | "register")}
                        className="w-full pt-3"
                      >
                        <TabsList className="grid grid-cols-2 bg-[#E8E8ED] p-1 rounded-xl">
                          <TabsTrigger
                            value="login"
                            className="text-xs font-semibold py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#1D1D1F] data-[state=active]:shadow-sm text-[#6E6E73]"
                          >
                            Sign In
                          </TabsTrigger>
                          <TabsTrigger
                            value="register"
                            className="text-xs font-semibold py-1.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#1D1D1F] data-[state=active]:shadow-sm text-[#6E6E73]"
                          >
                            Register Candidate
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </CardHeader>

                    <form onSubmit={handleAuth}>
                      <CardContent className="space-y-3.5 pt-4">
                        {authMode === "register" && (
                          <div className="space-y-1.5">
                            <Label htmlFor="fullname" className="text-xs font-semibold text-[#1D1D1F]">
                              Full Candidate Name
                            </Label>
                            <Input
                              id="fullname"
                              type="text"
                              placeholder="e.g. Jane Doe"
                              value={fullNameInput}
                              onChange={(e) => setFullNameInput(e.target.value)}
                              required={authMode === "register"}
                              className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] placeholder:text-[#86868B] focus-visible:bg-white focus-visible:border-[#0071E3] rounded-xl"
                            />
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label htmlFor="email" className="text-xs font-semibold text-[#1D1D1F]">
                            Email Address
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="student@example.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            required
                            className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] placeholder:text-[#86868B] focus-visible:bg-white focus-visible:border-[#0071E3] rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="password" className="text-xs font-semibold text-[#1D1D1F]">
                            Password
                          </Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            required
                            className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] placeholder:text-[#86868B] focus-visible:bg-white focus-visible:border-[#0071E3] rounded-xl"
                          />
                        </div>
                      </CardContent>

                      <CardFooter className="pt-2 pb-6 px-6">
                        <Button
                          type="submit"
                          disabled={authLoading}
                          className="w-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold rounded-xl h-10 shadow-sm transition-colors"
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
      <footer className="border-t border-[#D2D2D7]/80 bg-white py-4 text-center text-xs text-[#86868B]">
        <p>ExamPortal Proctoring Engine • All rights reserved</p>
      </footer>
    </div>
  );
}
