"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  GraduationCap,
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
        const studentName = profile?.full_name || data.user.email || "Student";
        toast.success(`Authenticated as ${studentName}!`);
        setStudentSuccessMessage(
          `Welcome, ${studentName}! You have successfully authenticated. Access your assigned examination via the link provided by your institution.`
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
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col items-center justify-center p-6 selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      {/* Brand Header */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition mb-3"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Home</span>
        </Link>
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="size-9 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
            <GraduationCap className="size-5" />
          </div>
          <span className="text-[20px] font-semibold tracking-tight text-[#1D1D1F]">
            ExamPortal
          </span>
        </Link>
      </div>

      {/* Main Auth Card */}
      <div className="w-full max-w-[420px] bg-white border border-[#D2D2D7] rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
        {/* Segmented Role Switcher */}
        <div className="grid grid-cols-2 p-1 bg-[#E8E8ED] rounded-xl text-[13px] font-medium">
          <button
            type="button"
            onClick={() => handleRoleToggle("admin")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
              role === "admin"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            <Lock className="size-3.5" />
            <span>Administrator</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleToggle("student")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
              role === "student"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            <GraduationCap className="size-3.5" />
            <span>Candidate</span>
          </button>
        </div>

        <div className="space-y-1 text-center">
          <h1 className="text-[20px] font-semibold tracking-tight text-[#1D1D1F]">
            {role === "admin" ? "Administrator Console" : "Candidate Sign In"}
          </h1>
          <p className="text-[13px] text-[#6E6E73]">
            {role === "admin"
              ? "Sign in to manage question banks, subjects, and exams."
              : "Enter your registered credentials to access examination sessions."}
          </p>
        </div>

        {studentSuccessMessage ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#34C759]/30 bg-[#34C759]/10 p-4 text-[#1E7E34] space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[14px]">
                <CheckCircle2 className="size-4.5 shrink-0 text-[#34C759]" />
                <span>Authentication Successful</span>
              </div>
              <p className="text-[12px] leading-relaxed text-[#1E7E34]/90">
                {studentSuccessMessage}
              </p>
            </div>

            <div className="rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] p-3.5 flex items-start gap-2.5 text-[12px] text-[#6E6E73]">
              <Info className="size-4 text-[#0071E3] shrink-0 mt-0.5" />
              <span>
                If you have an exam link, paste it in your browser address bar to begin your proctored assessment.
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-10 border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-[13px] rounded-xl font-medium"
              onClick={() => {
                setStudentSuccessMessage(null);
                setPassword("");
              }}
            >
              Sign In with another account
            </Button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[12px] font-medium text-[#1D1D1F]">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 size-4 text-[#86868B] pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder={role === "admin" ? "admin@examportal.com" : "candidate@examportal.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] placeholder:text-[#86868B] focus-visible:bg-white focus-visible:border-[#0071E3] focus-visible:ring-2 focus-visible:ring-[#0071E3]/20 text-[14px] h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[12px] font-medium text-[#1D1D1F]">
                Password
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 size-4 text-[#86868B] pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] placeholder:text-[#86868B] focus-visible:bg-white focus-visible:border-[#0071E3] focus-visible:ring-2 focus-visible:ring-[#0071E3]/20 text-[14px] h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-[14px] rounded-xl shadow-xs transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <span>
                    {role === "admin" ? "Sign In as Administrator" : "Sign In to Candidate Portal"}
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Security notice footer */}
      <div className="mt-8 text-center text-[12px] text-[#6E6E73]">
        <p>Protected by end-to-end examination session tokens.</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center text-[#6E6E73]">
          <Loader2 className="size-8 animate-spin text-[#0071E3]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
