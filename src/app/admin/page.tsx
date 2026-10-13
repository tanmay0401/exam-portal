"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  HelpCircle,
  FileText,
  Users,
  Plus,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DashboardStats {
  totalSubjects: number;
  totalQuestions: number;
  activeExams: number;
  totalAttempts: number;
}

interface RecentExam {
  id: string;
  title: string;
  status: string;
  total_questions: number;
  duration_minutes: number;
  created_at: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSubjects: 0,
    totalQuestions: 0,
    activeExams: 0,
    totalAttempts: 0,
  });
  const [recentExams, setRecentExams] = useState<RecentExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const supabase = createClient();

      // Parallel queries for fast, robust count resolution
      const [
        subjectsRes,
        questionsRes,
        activeExamsRes,
        attemptsRes,
        recentExamsRes,
      ] = await Promise.all([
        supabase.from("subjects").select("*", { count: "exact", head: true }),
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase
          .from("exams")
          .select("*", { count: "exact", head: true })
          .eq("status", "published"),
        supabase
          .from("exam_attempts")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("exams")
          .select("id, title, status, total_questions, duration_minutes, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (subjectsRes.error) throw subjectsRes.error;
      if (questionsRes.error) throw questionsRes.error;
      if (activeExamsRes.error) throw activeExamsRes.error;
      if (attemptsRes.error) throw attemptsRes.error;

      setStats({
        totalSubjects: subjectsRes.count ?? 0,
        totalQuestions: questionsRes.count ?? 0,
        activeExams: activeExamsRes.count ?? 0,
        totalAttempts: attemptsRes.count ?? 0,
      });

      if (recentExamsRes.data) {
        setRecentExams(recentExamsRes.data as RecentExam[]);
      }

      if (isManualRefresh) {
        toast.success("Dashboard metrics updated.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const statCards = [
    {
      title: "Total Subjects",
      value: stats.totalSubjects,
      description: "Academic courses configured",
      icon: BookOpen,
      iconColor: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      href: "/admin/subjects",
    },
    {
      title: "Total Questions",
      value: stats.totalQuestions,
      description: "Question bank repository",
      icon: HelpCircle,
      iconColor: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      href: "/admin/subjects",
    },
    {
      title: "Active Exams",
      value: stats.activeExams,
      description: "Published & ready for students",
      icon: FileText,
      iconColor: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      href: "/admin/exams",
    },
    {
      title: "Total Attempts",
      value: stats.totalAttempts,
      description: "Submissions & sessions",
      icon: Users,
      iconColor: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
      href: "/admin/exams",
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header section with greetings and quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Admin Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time status overview of test banks, examinations, and student attempts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData(true)}
            disabled={isLoading || isRefreshing}
            className="border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 text-xs h-9"
          >
            <RefreshCw
              className={`size-3.5 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </Button>

          <Link href="/admin/exams">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/25 text-xs h-9"
            >
              <Plus className="size-3.5 mr-1.5" />
              <span>Create Exam</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <AlertCircle className="size-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchDashboardData()}
            className="text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card
              key={idx}
              className="border-slate-800/80 bg-slate-900/50 backdrop-blur-md shadow-lg relative overflow-hidden group hover:border-slate-700 transition"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {card.title}
                </CardTitle>
                <div
                  className={`size-9 rounded-lg ${card.bgColor} ${card.borderColor} border flex items-center justify-center`}
                >
                  <Icon className={`size-4.5 ${card.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2 py-1">
                    <div className="h-8 w-20 bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-32 bg-slate-800/60 rounded animate-pulse" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-3xl font-extrabold text-white tracking-tight">
                      {card.value.toLocaleString()}
                    </div>
                    <p className="text-xs text-slate-400">
                      {card.description}
                    </p>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-800/60">
                  <Link
                    href={card.href}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <span>Manage</span>
                    <ArrowUpRight className="size-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions & Recent Exams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Panel */}
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="size-4 text-indigo-400" />
              <span>Quick Actions</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Frequently accessed management functions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/exams" className="block w-full">
              <Button
                variant="outline"
                className="w-full justify-start h-11 border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 text-slate-200 text-xs"
              >
                <FileText className="size-4 mr-2.5 text-indigo-400" />
                <span>Configure New Assessment</span>
              </Button>
            </Link>

            <Link href="/admin/subjects" className="block w-full">
              <Button
                variant="outline"
                className="w-full justify-start h-11 border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 text-slate-200 text-xs"
              >
                <BookOpen className="size-4 mr-2.5 text-blue-400" />
                <span>Create Subject or Topic</span>
              </Button>
            </Link>

            <Link href="/admin/subjects" className="block w-full">
              <Button
                variant="outline"
                className="w-full justify-start h-11 border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 text-slate-200 text-xs"
              >
                <HelpCircle className="size-4 mr-2.5 text-emerald-400" />
                <span>Upload Question Bank (CSV / Manual)</span>
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Exams List */}
        <Card className="lg:col-span-2 border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-white">
                Recent Exams
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Latest created or published examination papers.
              </CardDescription>
            </div>
            <Link href="/admin/exams">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                View All &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-14 bg-slate-800/50 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : recentExams.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No examinations found. Click &quot;Create Exam&quot; to build your first assessment.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {recentExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="font-medium text-sm text-slate-200 truncate">
                        {exam.title}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <HelpCircle className="size-3 text-slate-500" />
                          {exam.total_questions} Questions
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-slate-500" />
                          {exam.duration_minutes} Mins
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                          exam.status === "published"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : exam.status === "closed"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {exam.status}
                      </span>
                      <Link href={`/admin/exams`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-white size-8"
                        >
                          <ArrowUpRight className="size-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
