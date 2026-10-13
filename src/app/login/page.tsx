"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { toast } from "sonner";
import {
  GraduationCap,
  ShieldAlert,
  Lock,
  Mail,
  KeyRound,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Info,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRoleParam = searchParams.get("role");

  const [role, setRole] = useState<"admin" | "student">(
    initialRoleParam === "admin" ? "admin" : "student"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [studentSuccessMessage, setStudentSuccessMessage] = useState<string | null>(null);

  // Sync state if URL query param changes
  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "admin" || roleParam === "student") {
      setRole(roleParam);
    }
  }, [searchParams]);

  const handleRoleToggle = (selectedRole: "admin" | "student") => {
    setRole(selectedRole);
    setStudentSuccessMessage(null);
    router.replace(`/login?role=${selectedRole}`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    setStudentSuccessMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast.error(error.message || "Failed to sign in. Please verify your credentials.");
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        toast.error("No user returned from authentication.");
        setIsLoading(false);
        return;
      }

      // Query user role profile if available
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", data.user.id)
        .maybeSingle();

      if (role === "admin") {
        if (profile && profile.role !== "admin") {
          toast.error("Access denied. Your account is not authorized as an administrator.");
          await supabase.auth.signOut();
          setIsLoading(false);
          return;
        }

        toast.success(`Welcome back, ${profile?.full_name || "Administrator"}!`);
        router.push("/admin");
      } else {
        // Student sign-in
        const studentName = profile?.full_name || data.user.email || "Student";
        toast.success(`Authenticated as ${studentName}!`);
        setStudentSuccessMessage(
          `Welcome, ${studentName}! You have successfully authenticated. If you have been invited to an ongoing assessment, please access the direct exam link provided by your institution.`
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background ambient accents */}
      <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-transparent blur-[120px]" />

      {/* Top Brand Link */}
      <div className="relative z-10 mb-8 flex flex-col items-center gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-2"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Home</span>
        </Link>
        <Link href="/" className="flex items-center gap-2.5 font-bold text-2xl group">
          <div className="size-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/25">
            <div className="size-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <GraduationCap className="size-5 text-indigo-400" />
            </div>
          </div>
          <span className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent font-extrabold tracking-tight">
            ExamPortal
          </span>
        </Link>
      </div>

      <Card className="relative z-10 w-full max-w-md border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/50 text-slate-100">
        <CardHeader className="space-y-3 pb-4">
          {/* Role Toggle Selector */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-lg border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleRoleToggle("admin")}
              className={`flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                role === "admin"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Lock className="size-3.5" />
              <span>Administrator</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleToggle("student")}
              className={`flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                role === "student"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <GraduationCap className="size-3.5" />
              <span>Student</span>
            </button>
          </div>

          <div className="text-center pt-2">
            <CardTitle className="text-xl font-bold text-white tracking-tight">
              {role === "admin" ? "Admin Management Portal" : "Student Candidate Login"}
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1">
              {role === "admin"
                ? "Sign in to manage subjects, author questions, and administer exams."
                : "Enter credentials to access candidate evaluations and testing sessions."}
            </CardDescription>
          </div>
        </CardHeader>

        {studentSuccessMessage ? (
          <CardContent className="space-y-4 py-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300 space-y-3">
              <div className="flex items-center gap-2.5 font-semibold text-sm text-emerald-200">
                <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                <span>Verification Successful</span>
              </div>
              <p className="text-xs leading-relaxed text-emerald-300/90">
                {studentSuccessMessage}
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5 flex items-start gap-2.5 text-xs text-slate-400">
              <Info className="size-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                If you have an exam link with a token, open it in your browser to start the randomized assessment.
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-200 text-xs"
              onClick={() => {
                setStudentSuccessMessage(null);
                setPassword("");
              }}
            >
              Sign In with another account
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-slate-300">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-slate-500 pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={role === "admin" ? "admin@examportal.edu" : "candidate@school.edu"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-9 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 text-sm h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-slate-300">
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 size-4 text-slate-500 pointer-events-none" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-9 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 text-sm h-9"
                  />
                </div>
              </div>

              {role === "student" && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 text-[11px] text-slate-400 flex items-center gap-2">
                  <Info className="size-3.5 text-indigo-400 shrink-0" />
                  <span>
                    Exam credentials are authorized per institution session.
                  </span>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/25 transition-all text-sm rounded-lg"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <span>
                    {role === "admin" ? "Sign In as Administrator" : "Sign In to Exam"}
                  </span>
                )}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          <Loader2 className="size-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
