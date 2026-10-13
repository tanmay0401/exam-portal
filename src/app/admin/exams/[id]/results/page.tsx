"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart3,
  Download,
  RefreshCw,
  Award,
  AlertTriangle,
  Clock,
  ChevronLeft,
  Eye,
  Shield,
  Users,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Search,
  FileText,
  VideoOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AttemptRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  score: number | null;
  total_correct: number;
  total_incorrect: number;
  total_unanswered: number;
  started_at: string;
  submitted_at: string | null;
  is_auto_submitted: boolean;
  is_dry_run: boolean;
  status: string;
  warnings_count: number;
  proctor_log_summary: {
    total_events: number;
    tab_switches: number;
    fullscreen_exits: number;
    face_losses: number;
    camera_disconnects?: number;
    multiple_faces?: number;
    head_turns?: number;
    looking_down?: number;
    gaze_away?: number;
  };
  proctor_log: Array<{
    event_type: string;
    timestamp: string;
    details?: unknown;
  }>;
}

interface QuestionResponseDetail {
  response_id: string;
  question_id: string;
  question_order: number;
  question_text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  selected_option: string | null;
  correct_option: string;
  is_correct: boolean | null;
  marks_awarded: number;
  explanation: string;
}

interface AttemptDetailData {
  attempt: {
    id: string;
    student_name: string;
    student_email: string;
    score: number | null;
    total_correct: number;
    total_incorrect: number;
    total_unanswered: number;
    status: string;
  };
  responses: QuestionResponseDetail[];
}

interface ExamSummary {
  id: string;
  title: string;
  max_marks: number;
  total_questions: number;
}

export default function AdminExamResultsPage() {
  const routeParams = useParams();
  const examId = (routeParams?.id as string) || "";

  const [exam, setExam] = useState<ExamSummary | null>(null);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<string>("live");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  // Proctor details dialog
  const [selectedAttemptForProctor, setSelectedAttemptForProctor] = useState<AttemptRecord | null>(null);

  // Question responses dialog
  const [selectedAttemptForResponses, setSelectedAttemptForResponses] = useState<string | null>(null);
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetailData | null>(null);
  const [loadingResponses, setLoadingResponses] = useState(false);

  // Fetch results from API
  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/results/${examId}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load examination results");
      } else {
        setExam(data.exam);
        setAttempts(data.attempts || []);
      }
    } catch {
      setError("Network error while loading assessment results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [examId]);

  // Fetch individual attempt responses
  const handleViewResponses = async (attemptId: string) => {
    setSelectedAttemptForResponses(attemptId);
    setLoadingResponses(true);
    setAttemptDetail(null);
    try {
      const res = await fetch(`/api/results/${examId}/attempts/${attemptId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load attempt responses");
      } else {
        setAttemptDetail(data);
      }
    } catch {
      toast.error("Network error while loading responses");
    } finally {
      setLoadingResponses(false);
    }
  };

  // Filter by Tab (live vs dry run)
  const filteredByTab = useMemo(() => {
    return attempts.filter((att) => {
      if (activeTab === "live") return !att.is_dry_run;
      return att.is_dry_run;
    });
  }, [attempts, activeTab]);

  // Filter by Search & Sort
  const processedAttempts = useMemo(() => {
    let result = [...filteredByTab];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.student_name.toLowerCase().includes(q) ||
          a.student_email.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const scoreA = a.score ?? -999;
      const scoreB = b.score ?? -999;
      return sortDirection === "desc" ? scoreB - scoreA : scoreA - scoreB;
    });

    return result;
  }, [filteredByTab, searchQuery, sortDirection]);

  // Metrics computation
  const stats = useMemo(() => {
    const list = filteredByTab.filter((a) => a.score !== null);
    if (list.length === 0) {
      return {
        total: filteredByTab.length,
        avg: 0,
        highest: 0,
        lowest: 0,
      };
    }

    const scores = list.map((a) => a.score as number);
    const sum = scores.reduce((acc, curr) => acc + curr, 0);
    const avg = Math.round((sum / scores.length) * 10) / 10;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);

    return {
      total: filteredByTab.length,
      avg,
      highest,
      lowest,
    };
  }, [filteredByTab]);

  // Export to CSV
  const handleExportCSV = () => {
    if (processedAttempts.length === 0) {
      toast.info("No records to export.");
      return;
    }

    const headers = [
      "Student Name",
      "Email",
      "Score",
      "Max Marks",
      "Correct",
      "Incorrect",
      "Unanswered",
      "Auto Submitted",
      "Submitted At",
      "Proctor Warnings",
    ];

    const rows = processedAttempts.map((a) => [
      `"${a.student_name.replace(/"/g, '""')}"`,
      `"${a.student_email.replace(/"/g, '""')}"`,
      a.score ?? "N/A",
      exam?.max_marks ?? 100,
      a.total_correct,
      a.total_incorrect,
      a.total_unanswered,
      a.is_auto_submitted ? "Yes" : "No",
      a.submitted_at ? `"${new Date(a.submitted_at).toLocaleString().replace(/"/g, '""')}"` : "In Progress",
      a.warnings_count,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${exam?.title || "Exam"}_${activeTab}_results_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("CSV report downloaded successfully");
  };

  const toggleSort = () => {
    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-tr from-indigo-600/15 via-purple-600/15 to-blue-600/10 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <Link href="/admin/exams">
                <ChevronLeft className="size-4 mr-1" />
                Back to Exams
              </Link>
            </Button>
            <div className="h-5 w-px bg-slate-800" />
            <div>
              <h1 className="font-bold text-base text-white tracking-tight truncate max-w-sm sm:max-w-md">
                {exam?.title || "Exam Results Ledger"}
              </h1>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Evaluation Analytics & Proctor Audit
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchResults}
              disabled={loading}
              className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs h-8"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleExportCSV}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs h-8 shadow-sm"
            >
              <Download className="size-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {loading && attempts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="size-10 text-indigo-400 animate-spin" />
            <p className="text-slate-400 text-sm">Aggregating student submissions...</p>
          </div>
        ) : error ? (
          <Card className="border-rose-900/50 bg-rose-950/20 backdrop-blur-xl text-center p-8">
            <AlertTriangle className="size-12 text-rose-400 mx-auto mb-3" />
            <CardTitle className="text-xl font-bold text-rose-200">
              Failed to Load Results
            </CardTitle>
            <CardDescription className="text-rose-300/80 text-xs mt-1">
              {error}
            </CardDescription>
            <Button
              onClick={fetchResults}
              className="mt-6 bg-slate-800 hover:bg-slate-700 text-white text-xs"
            >
              Retry
            </Button>
          </Card>
        ) : (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Attempts */}
              <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                  <span className="text-xs text-slate-400 font-medium">Total Attempts</span>
                  <Users className="size-4 text-indigo-400" />
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-2xl font-black text-white">{stats.total}</div>
                  <span className="text-[11px] text-slate-400">Recorded candidates</span>
                </CardContent>
              </Card>

              {/* Average Score */}
              <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                  <span className="text-xs text-slate-400 font-medium">Average Score</span>
                  <BarChart3 className="size-4 text-cyan-400" />
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-2xl font-black text-cyan-300">
                    {stats.avg}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      / {exam?.max_marks ?? 100}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Cohort mean</span>
                </CardContent>
              </Card>

              {/* Highest Score */}
              <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                  <span className="text-xs text-slate-400 font-medium">Highest Score</span>
                  <TrendingUp className="size-4 text-emerald-400" />
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-2xl font-black text-emerald-400">
                    {stats.highest}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      / {exam?.max_marks ?? 100}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Top performance</span>
                </CardContent>
              </Card>

              {/* Lowest Score */}
              <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                  <span className="text-xs text-slate-400 font-medium">Lowest Score</span>
                  <TrendingDown className="size-4 text-rose-400" />
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-2xl font-black text-rose-400">
                    {stats.lowest}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      / {exam?.max_marks ?? 100}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Minimum mark</span>
                </CardContent>
              </Card>
            </div>

            {/* Results Table Section */}
            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
              <CardHeader className="p-4 sm:p-6 border-b border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Tabs */}
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                    <TabsList className="bg-slate-950/80 border border-slate-800">
                      <TabsTrigger value="live" className="text-xs data-active:bg-indigo-600 data-active:text-white">
                        Live Results ({attempts.filter((a) => !a.is_dry_run).length})
                      </TabsTrigger>
                      <TabsTrigger value="dry_run" className="text-xs data-active:bg-indigo-600 data-active:text-white">
                        Dry Run Results ({attempts.filter((a) => a.is_dry_run).length})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Search bar */}
                  <div className="relative w-full sm:w-64">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search student or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 bg-slate-950/60 border-slate-800 text-xs h-8 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-950/60 border-b border-slate-800">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs font-semibold py-3">Student Name</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold">Email</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold cursor-pointer" onClick={toggleSort}>
                        <div className="flex items-center gap-1.5 hover:text-white">
                          <span>Score</span>
                          <ArrowUpDown className="size-3" />
                        </div>
                      </TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold text-center">Correct</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold text-center">Incorrect</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold text-center">Unanswered</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold">Submitted At</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold text-center">Mode</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold text-center">Proctor Warnings</TableHead>
                      <TableHead className="text-slate-400 text-xs font-semibold text-center">Responses</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {processedAttempts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-slate-400 text-xs">
                          No attempt records match current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      processedAttempts.map((attempt) => (
                        <TableRow key={attempt.id} className="border-slate-800/60 hover:bg-slate-800/30 text-xs">
                          {/* Name */}
                          <TableCell className="font-medium text-white py-3">
                            {attempt.student_name}
                          </TableCell>

                          {/* Email */}
                          <TableCell className="text-slate-400 font-mono text-[11px]">
                            {attempt.student_email}
                          </TableCell>

                          {/* Score */}
                          <TableCell className="font-bold">
                            {attempt.score !== null ? (
                              <span
                                className={
                                  attempt.score >= (exam?.max_marks ? exam.max_marks * 0.4 : 40)
                                     ? "text-emerald-400"
                                    : "text-rose-400"
                                }
                              >
                                {attempt.score}{" "}
                                <span className="text-[10px] text-slate-500 font-normal">
                                  / {exam?.max_marks ?? 100}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">In Progress</span>
                            )}
                          </TableCell>

                          {/* Correct */}
                          <TableCell className="text-center text-emerald-400 font-medium">
                            {attempt.total_correct}
                          </TableCell>

                          {/* Incorrect */}
                          <TableCell className="text-center text-rose-400 font-medium">
                            {attempt.total_incorrect}
                          </TableCell>

                          {/* Unanswered */}
                          <TableCell className="text-center text-slate-400">
                            {attempt.total_unanswered}
                          </TableCell>

                          {/* Submitted */}
                          <TableCell className="text-slate-400 text-[11px]">
                            {attempt.submitted_at ? (
                              new Date(attempt.submitted_at).toLocaleString([], {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            ) : (
                              <span className="text-amber-400 text-[11px]">Active</span>
                            )}
                          </TableCell>

                          {/* Auto Submitted Badge */}
                          <TableCell className="text-center">
                            {attempt.is_auto_submitted ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/30 py-0.5">
                                <Clock className="size-2.5 mr-1" />
                                Auto
                              </Badge>
                            ) : attempt.submitted_at ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30 py-0.5">
                                Manual
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-400 border-slate-700 py-0.5">
                                Ongoing
                              </Badge>
                            )}
                          </TableCell>

                          {/* Proctor Warnings */}
                          <TableCell className="text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedAttemptForProctor(attempt)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition hover:scale-105 ${
                                attempt.warnings_count > 0
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              }`}
                            >
                              <Shield className="size-3" />
                              <span>{attempt.warnings_count} alerts</span>
                              <Eye className="size-3 ml-0.5 opacity-70" />
                            </button>
                          </TableCell>

                          {/* Detailed Responses Action */}
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewResponses(attempt.id)}
                              className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 text-[11px] h-7 px-2"
                            >
                              <FileText className="size-3 mr-1" />
                              <span>Answers</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* Proctor Event Details Dialog */}
      <Dialog
        open={!!selectedAttemptForProctor}
        onOpenChange={(open) => !open && setSelectedAttemptForProctor(null)}
      >
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="size-4 text-indigo-400" />
              Proctor Audit: {selectedAttemptForProctor?.student_name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Complete timeline of window visibility changes and suspicious activity logs during assessment.
            </DialogDescription>
          </DialogHeader>

          {selectedAttemptForProctor && (
            <div className="space-y-4 py-2">
              {/* Categorical Summary Badges */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">Tab Switches</span>
                  <span className="text-sm font-bold text-amber-400">
                    {selectedAttemptForProctor.proctor_log_summary.tab_switches}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">Fullscreen Exits</span>
                  <span className="text-sm font-bold text-rose-400">
                    {selectedAttemptForProctor.proctor_log_summary.fullscreen_exits}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">Face Losses</span>
                  <span className="text-sm font-bold text-rose-300">
                    {selectedAttemptForProctor.proctor_log_summary.face_losses}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">Camera Drops</span>
                  <span className="text-sm font-bold text-rose-500">
                    {selectedAttemptForProctor.proctor_log_summary.camera_disconnects || 0}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">Multi-Face</span>
                  <span className="text-sm font-bold text-purple-400">
                    {selectedAttemptForProctor.proctor_log_summary.multiple_faces || 0}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">Head Turns</span>
                  <span className="text-sm font-bold text-amber-300">
                    {selectedAttemptForProctor.proctor_log_summary.head_turns || 0}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 col-span-2">
                  <span className="text-slate-400 block text-[9px]">Total Monitored Alerts</span>
                  <span className="text-sm font-bold text-slate-200">
                    {selectedAttemptForProctor.proctor_log_summary.total_events}
                  </span>
                </div>
              </div>

              {/* Advisory Clarification Notice */}
              <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-start gap-2">
                <Shield className="size-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Advisory Note:</strong> AI detections highlight potential environmental changes (e.g. movement, secondary individuals, camera interruptions). Automated flags should be reviewed with context and do not automatically confirm misconduct.
                </span>
              </div>

              {/* Event Logs Timeline */}
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 text-xs">
                {selectedAttemptForProctor.proctor_log.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    No integrity warnings logged. Clean attempt session.
                  </div>
                ) : (
                  selectedAttemptForProctor.proctor_log.map((log, idx) => {
                    const isHighAlert = [
                      "multiple_faces_detected",
                      "fullscreen_exit",
                      "background_person_detected",
                      "camera_disconnected",
                    ].includes(log.event_type);
                    const isMediumAlert = [
                      "tab_hidden",
                      "face_not_detected",
                      "head_turned_away",
                      "looking_down",
                    ].includes(log.event_type);

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-start justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <span
                              className={`size-2 rounded-full ${
                                isHighAlert
                                  ? "bg-rose-500"
                                  : isMediumAlert
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
                              }`}
                            />
                            <span className="capitalize">
                              {log.event_type.replace(/_/g, " ")}
                            </span>
                            {isHighAlert && (
                              <Badge variant="destructive" className="text-[9px] py-0 px-1">
                                High Flag
                              </Badge>
                            )}
                          </div>
                          {log.details ? (
                            <div className="text-[11px] text-slate-400">
                              {typeof log.details === "string"
                                ? log.details
                                : (log.details as any)?.message || JSON.stringify(log.details)}
                            </div>
                          ) : null}
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Question-Wise Responses Dialog */}
      <Dialog
        open={!!selectedAttemptForResponses}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAttemptForResponses(null);
            setAttemptDetail(null);
          }
        }}
      >
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="size-4 text-indigo-400" />
              Candidate Responses: {attemptDetail?.attempt?.student_name || "Assessment Review"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Question-by-question breakdown, candidate selections, answer keys, and awarded marks.
            </DialogDescription>
          </DialogHeader>

          {loadingResponses ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <Loader2 className="size-8 text-indigo-400 animate-spin" />
              <p className="text-xs text-slate-400">Loading student responses...</p>
            </div>
          ) : attemptDetail ? (
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
              {/* Summary Banner */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Student: </span>
                  <strong className="text-white">{attemptDetail.attempt.student_name}</strong>
                  <span className="text-slate-500 font-mono text-[11px] ml-1">({attemptDetail.attempt.student_email})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                    Score: {attemptDetail.attempt.score ?? 0} / {exam?.max_marks ?? 100}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                    +{attemptDetail.attempt.total_correct} Correct
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-300 border-rose-500/20">
                    -{attemptDetail.attempt.total_incorrect} Incorrect
                  </Badge>
                </div>
              </div>

              {/* Question List */}
              {attemptDetail.responses.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No response data recorded for this attempt.
                </div>
              ) : (
                attemptDetail.responses.map((r, idx) => {
                  const isCorrect = r.is_correct === true;
                  const isWrong = r.is_correct === false && r.selected_option !== null;

                  return (
                    <div
                      key={r.response_id || idx}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-slate-200">
                          Q{r.question_order}. {r.question_text}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-2 shrink-0 ${
                            isCorrect
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                              : isWrong
                              ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          {isCorrect
                            ? `+${r.marks_awarded || 4} Marks`
                            : isWrong
                            ? `${r.marks_awarded || -1} Mark`
                            : "0 (Unattempted)"}
                        </Badge>
                      </div>

                      {/* Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {(["A", "B", "C", "D"] as const).map((optKey) => {
                          const optText = r.options[optKey];
                          if (!optText) return null;
                          const isSelected = r.selected_option?.trim().toUpperCase() === optKey;
                          const isAnswerKey = r.correct_option?.trim().toUpperCase() === optKey;

                          let optClass = "border-slate-800/80 bg-slate-900/40 text-slate-400";
                          if (isAnswerKey) {
                            optClass = "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 font-medium";
                          } else if (isSelected && !isAnswerKey) {
                            optClass = "border-rose-500/40 bg-rose-500/10 text-rose-200 font-medium";
                          }

                          return (
                            <div
                              key={optKey}
                              className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-1.5 ${optClass}`}
                            >
                              <span className="truncate">
                                <strong className="mr-1">{optKey}.</strong> {optText}
                              </span>
                              {isAnswerKey && (
                                <span className="text-[9px] text-emerald-400 font-bold shrink-0">Correct Key</span>
                              )}
                              {isSelected && !isAnswerKey && (
                                <span className="text-[9px] text-rose-400 font-bold shrink-0">Candidate Choice</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {r.explanation && (
                        <div className="p-2 rounded bg-indigo-950/20 border border-indigo-500/10 text-[11px] text-indigo-300">
                          <strong>Explanation:</strong> {r.explanation}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950/40 py-4 text-center text-xs text-slate-500">
        <p>ExamPortal Admin Console • Examination Integrity Reporting</p>
      </footer>
    </div>
  );
}
