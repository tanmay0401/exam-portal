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
  Clock,
  Layers,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
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
        setRecentExams(recentExamsRes.data);
      }

      if (isManualRefresh) {
        toast.success("Dashboard metrics updated.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard metrics";
      setError(msg);
      toast.error(msg);
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
      href: "/admin/subjects",
    },
    {
      title: "Total Questions",
      value: stats.totalQuestions,
      description: "Question repository bank",
      icon: HelpCircle,
      href: "/admin/subjects",
    },
    {
      title: "Active Exams",
      value: stats.activeExams,
      description: "Published & available sessions",
      icon: FileText,
      href: "/admin/exams",
    },
    {
      title: "Candidate Attempts",
      value: stats.totalAttempts,
      description: "Submitted student tests",
      icon: Users,
      href: "/admin/exams",
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header section with greetings and quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
            Overview
          </h1>
          <p className="text-[14px] text-[#6E6E73] mt-0.5">
            Real-time status of academic subjects, question repositories, and assessment sessions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData(true)}
            disabled={isLoading || isRefreshing}
            className="border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] text-[13px] h-9 rounded-xl shadow-xs"
          >
            <RefreshCw
              className={`size-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-[#0071E3]" : "text-[#6E6E73]"}`}
            />
            <span>Refresh</span>
          </Button>

          <Link href="/admin/exams/new">
            <Button
              size="sm"
              className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-[13px] h-9 px-4 rounded-xl shadow-xs"
            >
              <Plus className="size-4 mr-1.5" />
              <span>New Exam</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-[#FF3B30]/30 bg-[#FF3B30]/10 p-4 text-[#D70015] flex items-center justify-between text-[13px]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-4.5 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchDashboardData()}
            className="text-[#D70015] hover:bg-[#FF3B30]/20 text-[12px] h-7 px-2"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link key={idx} href={card.href} className="group">
              <div className="bg-white border border-[#D2D2D7] rounded-2xl p-5 shadow-xs group-hover:border-[#B0B0B8] group-hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-medium text-[#6E6E73]">
                    {card.title}
                  </span>
                  <div className="size-8 rounded-lg bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors">
                    <Icon className="size-4" />
                  </div>
                </div>

                <div className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                  {isLoading ? (
                    <span className="inline-block size-6 bg-[#E8E8ED] animate-pulse rounded" />
                  ) : (
                    card.value
                  )}
                </div>

                <p className="text-[12px] text-[#6E6E73] mt-1">
                  {card.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Navigation & Recent Exams */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Exams Table */}
        <div className="lg:col-span-8 bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E5EA]">
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight text-[#1D1D1F]">
                Recent Examinations
              </h2>
              <p className="text-[12px] text-[#6E6E73]">
                Latest published and draft assessment papers
              </p>
            </div>
            <Link
              href="/admin/exams"
              className="text-[12px] font-medium text-[#0071E3] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-[13px] text-[#6E6E73]">
              Loading examinations...
            </div>
          ) : recentExams.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileText className="size-8 text-[#86868B] mx-auto opacity-50" />
              <p className="text-[13px] text-[#6E6E73]">No examinations created yet.</p>
              <Link href="/admin/exams/new">
                <Button size="sm" className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-[12px] rounded-xl mt-2">
                  Create First Exam
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E5EA]">
              {recentExams.map((exam) => (
                <div
                  key={exam.id}
                  className="py-3.5 flex items-center justify-between gap-4 hover:bg-[#F5F5F7]/50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <Link
                      href={`/admin/exams/${exam.id}`}
                      className="text-[14px] font-medium text-[#1D1D1F] hover:text-[#0071E3] truncate block"
                    >
                      {exam.title}
                    </Link>
                    <div className="flex items-center gap-2 text-[12px] text-[#6E6E73]">
                      <span>{exam.total_questions} Questions</span>
                      <span>•</span>
                      <span>{exam.duration_minutes} Mins</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        exam.status === "published"
                          ? "bg-[#34C759]/10 text-[#1E7E34] border border-[#34C759]/30"
                          : exam.status === "closed"
                          ? "bg-[#FF3B30]/10 text-[#D70015] border border-[#FF3B30]/30"
                          : "bg-[#E8E8ED] text-[#6E6E73] border border-[#D2D2D7]"
                      }`}
                    >
                      {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                    </span>
                    <Link href={`/admin/exams/${exam.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[12px] text-[#0071E3] hover:bg-[#0071E3]/10 h-7 px-2.5 rounded-lg"
                      >
                        Manage
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Launch & Guidance Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-[15px] font-semibold text-[#1D1D1F]">
              Quick Management
            </h2>

            <div className="space-y-2">
              <Link href="/admin/exams/new" className="block">
                <div className="p-3 rounded-xl border border-[#D2D2D7] hover:border-[#0071E3] hover:bg-[#F5F5F7] transition-all flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                    <Plus className="size-4" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#1D1D1F]">
                      Create New Exam
                    </div>
                    <div className="text-[11px] text-[#6E6E73]">
                      Configure rules & multi-batch generator
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/admin/subjects" className="block">
                <div className="p-3 rounded-xl border border-[#D2D2D7] hover:border-[#0071E3] hover:bg-[#F5F5F7] transition-all flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-[#34C759]/10 text-[#1E7E34] flex items-center justify-center">
                    <BookOpen className="size-4" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#1D1D1F]">
                      Manage Subjects
                    </div>
                    <div className="text-[11px] text-[#6E6E73]">
                      Author questions & CSV bulk import
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs space-y-2 text-[12px] text-[#6E6E73]">
            <span className="font-semibold text-[#1D1D1F] block text-[13px]">
              Examination System Status
            </span>
            <p className="leading-relaxed">
              AI proctoring telemetry is actively verified on all student attempts. Generated exam tokens allow direct HTTPS candidate access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
