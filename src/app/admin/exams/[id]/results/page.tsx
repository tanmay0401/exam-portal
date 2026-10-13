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
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between selection:bg-[#0071E3]/20 selection:text-[#0071E3]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#D2D2D7]/80 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] text-xs rounded-xl"
            >
              <Link href="/admin/exams">
                <ChevronLeft className="size-4 mr-1" />
                Back to Exams
              </Link>
            </Button>
            <div className="h-5 w-px bg-[#D2D2D7]" />
            <div>
              <h1 className="font-semibold text-base text-[#1D1D1F] tracking-tight truncate max-w-sm sm:max-w-md">
                {exam?.title || "Exam Results Ledger"}
              </h1>
              <span className="text-[11px] text-[#6E6E73] block mt-0.5">
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
              className="border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] text-xs h-8 rounded-xl"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleExportCSV}
              className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-xs h-8 rounded-xl shadow-sm"
            >
              <Download className="size-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {loading && attempts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="size-10 text-[#0071E3] animate-spin" />
            <p className="text-[#6E6E73] text-sm">Aggregating student submissions...</p>
          </div>
        ) : error ? (
          <Card className="border-[#FF3B30]/30 bg-white text-center p-8 rounded-2xl shadow-sm">
            <div className="size-12 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="size-6 text-[#FF3B30]" />
            </div>
            <CardTitle className="text-xl font-semibold text-[#1D1D1F]">
              Failed to Load Results
            </CardTitle>
            <CardDescription className="text-[#6E6E73] text-xs mt-1">
              {error}
            </CardDescription>
            <Button
              onClick={fetchResults}
              className="mt-6 bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs rounded-xl"
            >
              Retry
            </Button>
          </Card>
        ) : (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Attempts */}
              <Card className="border border-[#D2D2D7] bg-white rounded-xl shadow-sm">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                  <span className="text-xs text-[#6E6E73] font-medium">Total Attempts</span>
                  <Users className="size-4 text-[#0071E3]" />
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-2xl font-bold text-[#1D1D1F] font-mono">{stats.total}</div>
                  <span className="text-[11px] text-[#6E6E73]">Recorded candidates</span>
                </CardContent>
              </Card>

              {/* Average Score */}
              <Card className="border border-[#D2D2D7] bg-white rounded-xl shadow-sm">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                  <span className="text-xs text-[#6E6E73] font-medium">Average Score</span>
                  <BarChart3 className="size-4 text-[#0071E3]" />
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-2xl font-bold text-[#1D1D1F] font-mono">
                    {stats.avg}{" "}
                    <span className="text-xs font-normal text-[#6E6E73]">
                      / {exam?.max_marks ?? 100}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#6E6E73]">Cohort mean</span>
                </CardContent>
              </Card>

              {/* Highest Score */}
              <Card className="border border-[#D2D2D7] bg-white rounded-xl shadow-sm">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                  <span className="text-xs text-[#6E6E73] font-medium">Highest Score</span>
                  <TrendingUp className="size-4 text-[#34C759]" />
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-2xl font-bold text-[#1E7E34] font-mono">
                    {stats.highest}{" "}
                    <span className="text-xs font-normal text-[#6E6E73]">
                      / {exam?.max_marks ?? 100}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#6E6E73]">Top performance</span>
                </CardContent>
              </Card>

              {/* Lowest Score */}
              <Card className="border border-[#D2D2D7] bg-white rounded-xl shadow-sm">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                  <span className="text-xs text-[#6E6E73] font-medium">Lowest Score</span>
                  <TrendingDown className="size-4 text-[#FF3B30]" />
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-2xl font-bold text-[#D70015] font-mono">
                    {stats.lowest}{" "}
                    <span className="text-xs font-normal text-[#6E6E73]">
                      / {exam?.max_marks ?? 100}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#6E6E73]">Minimum mark</span>
                </CardContent>
              </Card>
            </div>

            {/* Results Table Section */}
            <Card className="border border-[#D2D2D7] bg-white rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="p-4 sm:p-5 border-b border-[#D2D2D7]/80 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Tabs */}
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                    <TabsList className="bg-[#E8E8ED] p-1 rounded-xl border-none">
                      <TabsTrigger value="live" className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#1D1D1F] data-[state=active]:shadow-sm text-[#6E6E73] rounded-lg font-medium">
                        Live Results ({attempts.filter((a) => !a.is_dry_run).length})
                      </TabsTrigger>
                      <TabsTrigger value="dry_run" className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#1D1D1F] data-[state=active]:shadow-sm text-[#6E6E73] rounded-lg font-medium">
                        Dry Run Results ({attempts.filter((a) => a.is_dry_run).length})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Search bar */}
                  <div className="relative w-full sm:w-64">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6E73]" />
                    <Input
                      placeholder="Search student or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 bg-white border-[#D2D2D7] text-xs h-8 text-[#1D1D1F] placeholder:text-[#6E6E73] rounded-lg"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-[#F5F5F7] border-b border-[#D2D2D7]">
                    <TableRow className="border-[#D2D2D7] hover:bg-transparent">
                      <TableHead className="text-[#6E6E73] text-xs font-semibold py-3">Student Name</TableHead>
                      <TableHead className="text-[#6E6E73] text-xs font-semibold">Email</TableHead>
                      <TableHead className="text-[#6E6E73] text-xs font-semibold cursor-pointer" onClick={toggleSort}>
                        <div className="flex items-center gap-1.5 hover:text-[#1D1D1F]">
                          <span>Score</span>
                          <ArrowUpDown className="size-3" />
                        </div>
                      </TableHead>
                      <TableHead className="text-[#6E6E73] text-xs font-semibold text-center">Correct</TableHead>
                      <TableHead className="text-[#6E6E73] text-xs font-semibold text-center">Incorrect</TableHead>
                      <TableHead className="text-[#6E6E73] text-xs font-semibold text-center">Unanswered</TableHead>
                      <TableHead className="text-[#6E6E73] text-xs font-semibold">Submitted At</TableHead>
                      <TableHead className="text-[#6E6E73] text-xs font-semibold text-center">Mode</TableHead>
                      <TableHead className="text-[#6E6E73] text-xs font-semibold text-center">Proctor Warnings</TableHead>
                      <TableHead className="text-[#6E6E73] text-xs font-semibold text-center">Responses</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {processedAttempts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-[#6E6E73] text-xs">
                          No attempt records match current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      processedAttempts.map((attempt) => (
                        <TableRow key={attempt.id} className="border-b border-[#D2D2D7]/60 hover:bg-[#F5F5F7]/60 text-xs transition-colors">
                          {/* Name */}
                          <TableCell className="font-medium text-[#1D1D1F] py-3">
                            {attempt.student_name}
                          </TableCell>

                          {/* Email */}
                          <TableCell className="text-[#6E6E73] font-mono text-[11px]">
                            {attempt.student_email}
                          </TableCell>

                          {/* Score */}
                          <TableCell className="font-bold font-mono">
                            {attempt.score !== null ? (
                              <span
                                className={
                                  attempt.score >= (exam?.max_marks ? exam.max_marks * 0.4 : 40)
                                     ? "text-[#1E7E34]"
                                    : "text-[#D70015]"
                                }
                              >
                                {attempt.score}{" "}
                                <span className="text-[10px] text-[#6E6E73] font-normal">
                                  / {exam?.max_marks ?? 100}
                                </span>
                              </span>
                            ) : (
                              <span className="text-[#6E6E73] italic font-normal">In Progress</span>
                            )}
                          </TableCell>

                          {/* Correct */}
                          <TableCell className="text-center text-[#1E7E34] font-medium font-mono">
                            {attempt.total_correct}
                          </TableCell>

                          {/* Incorrect */}
                          <TableCell className="text-center text-[#D70015] font-medium font-mono">
                            {attempt.total_incorrect}
                          </TableCell>

                          {/* Unanswered */}
                          <TableCell className="text-center text-[#6E6E73] font-mono">
                            {attempt.total_unanswered}
                          </TableCell>

                          {/* Submitted */}
                          <TableCell className="text-[#6E6E73] text-[11px]">
                            {attempt.submitted_at ? (
                              new Date(attempt.submitted_at).toLocaleString([], {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            ) : (
                              <span className="text-[#FF9500] font-medium text-[11px]">Active</span>
                            )}
                          </TableCell>

                          {/* Auto Submitted Badge */}
                          <TableCell className="text-center">
                            {attempt.is_auto_submitted ? (
                              <Badge variant="outline" className="text-[10px] bg-[#FF9500]/10 text-[#B25E00] border-[#FF9500]/30 py-0.5 rounded-full font-medium">
                                <Clock className="size-2.5 mr-1" />
                                Auto
                              </Badge>
                            ) : attempt.submitted_at ? (
                              <Badge variant="outline" className="text-[10px] bg-[#34C759]/10 text-[#1E7E34] border-[#34C759]/30 py-0.5 rounded-full font-medium">
                                Manual
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-[#E8E8ED] text-[#6E6E73] border-[#D2D2D7] py-0.5 rounded-full font-medium">
                                Ongoing
                              </Badge>
                            )}
                          </TableCell>

                          {/* Proctor Warnings */}
                          <TableCell className="text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedAttemptForProctor(attempt)}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition hover:opacity-85 ${
                                attempt.warnings_count > 0
                                  ? "bg-[#FF3B30]/10 text-[#D70015] border border-[#FF3B30]/25"
                                  : "bg-[#34C759]/10 text-[#1E7E34] border border-[#34C759]/25"
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
                              className="text-[#0071E3] hover:text-[#0077ED] hover:bg-[#0071E3]/10 text-[11px] h-7 px-2.5 rounded-lg font-medium"
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
        <DialogContent className="border border-[#D2D2D7] bg-white text-[#1D1D1F] sm:max-w-lg rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#1D1D1F] flex items-center gap-2">
              <Shield className="size-4 text-[#0071E3]" />
              Proctor Audit: {selectedAttemptForProctor?.student_name}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6E6E73]">
              Complete timeline of window visibility changes and suspicious activity logs during assessment.
            </DialogDescription>
          </DialogHeader>

          {selectedAttemptForProctor && (
            <div className="space-y-4 py-2">
              {/* Categorical Summary Badges */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
                  <span className="text-[#6E6E73] block text-[9px] font-medium">Tab Switches</span>
                  <span className="text-sm font-bold text-[#B25E00] font-mono">
                    {selectedAttemptForProctor.proctor_log_summary.tab_switches}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
                  <span className="text-[#6E6E73] block text-[9px] font-medium">Fullscreen Exits</span>
                  <span className="text-sm font-bold text-[#D70015] font-mono">
                    {selectedAttemptForProctor.proctor_log_summary.fullscreen_exits}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
                  <span className="text-[#6E6E73] block text-[9px] font-medium">Face Losses</span>
                  <span className="text-sm font-bold text-[#D70015] font-mono">
                    {selectedAttemptForProctor.proctor_log_summary.face_losses}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
                  <span className="text-[#6E6E73] block text-[9px] font-medium">Camera Drops</span>
                  <span className="text-sm font-bold text-[#D70015] font-mono">
                    {selectedAttemptForProctor.proctor_log_summary.camera_disconnects || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
                  <span className="text-[#6E6E73] block text-[9px] font-medium">Multi-Face</span>
                  <span className="text-sm font-bold text-[#5856D6] font-mono">
                    {selectedAttemptForProctor.proctor_log_summary.multiple_faces || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
                  <span className="text-[#6E6E73] block text-[9px] font-medium">Head Turns</span>
                  <span className="text-sm font-bold text-[#B25E00] font-mono">
                    {selectedAttemptForProctor.proctor_log_summary.head_turns || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
                  <span className="text-[#6E6E73] block text-[9px] font-medium">Looking Down</span>
                  <span className="text-sm font-bold text-[#B25E00] font-mono">
                    {selectedAttemptForProctor.proctor_log_summary.looking_down || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
                  <span className="text-[#6E6E73] block text-[9px] font-medium">Gaze Away</span>
                  <span className="text-sm font-bold text-[#0071E3] font-mono">
                    {selectedAttemptForProctor.proctor_log_summary.gaze_away || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]">
                  <span className="text-[#6E6E73] block text-[9px] font-medium">Total Alerts</span>
                  <span className="text-sm font-bold text-[#1D1D1F] font-mono">
                    {selectedAttemptForProctor.warnings_count ?? selectedAttemptForProctor.proctor_log_summary.total_events}
                  </span>
                </div>
              </div>

              {/* Advisory Clarification Notice */}
              <div className="p-3 rounded-xl bg-[#0071E3]/5 border border-[#0071E3]/20 text-[11px] text-[#0071E3] flex items-start gap-2 leading-relaxed">
                <Shield className="size-4 text-[#0071E3] shrink-0 mt-0.5" />
                <span>
                  <strong>Advisory Note:</strong> AI detections highlight potential environmental changes (e.g. movement, secondary individuals, camera interruptions). Automated flags should be reviewed with context and do not automatically confirm misconduct.
                </span>
              </div>

              {/* Event Logs Timeline */}
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 text-xs">
                {selectedAttemptForProctor.proctor_log.length === 0 ? (
                  <div className="text-center py-6 text-[#6E6E73] text-xs">
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
                        className={`p-3 rounded-xl border flex items-start justify-between gap-2.5 ${
                          isHighAlert
                            ? "border-[#FF3B30]/25 bg-[#FF3B30]/5"
                            : isMediumAlert
                            ? "border-[#FF9500]/25 bg-[#FF9500]/5"
                            : "border-[#D2D2D7] bg-[#F5F5F7]"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                            <span
                              className={`size-2 rounded-full ${
                                isHighAlert
                                  ? "bg-[#FF3B30]"
                                  : isMediumAlert
                                  ? "bg-[#FF9500]"
                                  : "bg-[#34C759]"
                              }`}
                            />
                            <span className="capitalize">
                              {log.event_type.replace(/_/g, " ")}
                            </span>
                            {isHighAlert && (
                              <Badge variant="destructive" className="text-[9px] py-0 px-1 bg-[#FF3B30]/10 text-[#D70015] border-[#FF3B30]/20 rounded-full font-medium">
                                High Flag
                              </Badge>
                            )}
                          </div>
                          {log.details ? (
                            <div className="text-[11px] text-[#6E6E73]">
                              {typeof log.details === "string"
                                ? log.details
                                : (log.details as any)?.message || JSON.stringify(log.details)}
                            </div>
                          ) : null}
                        </div>
                        <span className="text-[10px] text-[#6E6E73] shrink-0 font-mono">
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
        <DialogContent className="border border-[#D2D2D7] bg-white text-[#1D1D1F] sm:max-w-2xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#1D1D1F] flex items-center gap-2">
              <FileText className="size-4 text-[#0071E3]" />
              Candidate Responses: {attemptDetail?.attempt?.student_name || "Assessment Review"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6E6E73]">
              Question-by-question breakdown, candidate selections, answer keys, and awarded marks.
            </DialogDescription>
          </DialogHeader>

          {loadingResponses ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <Loader2 className="size-8 text-[#0071E3] animate-spin" />
              <p className="text-xs text-[#6E6E73]">Loading student responses...</p>
            </div>
          ) : attemptDetail ? (
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
              {/* Summary Banner */}
              <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[#6E6E73]">Student: </span>
                  <strong className="text-[#1D1D1F]">{attemptDetail.attempt.student_name}</strong>
                  <span className="text-[#6E6E73] font-mono text-[11px] ml-1">({attemptDetail.attempt.student_email})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/20 rounded-full font-medium">
                    Score: {attemptDetail.attempt.score ?? 0} / {exam?.max_marks ?? 100}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-[#34C759]/10 text-[#1E7E34] border-[#34C759]/20 rounded-full font-medium">
                    +{attemptDetail.attempt.total_correct} Correct
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-[#FF3B30]/10 text-[#D70015] border-[#FF3B30]/20 rounded-full font-medium">
                    -{attemptDetail.attempt.total_incorrect} Incorrect
                  </Badge>
                </div>
              </div>

              {/* Question List */}
              {attemptDetail.responses.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#6E6E73]">
                  No response data recorded for this attempt.
                </div>
              ) : (
                attemptDetail.responses.map((r, idx) => {
                  const isCorrect = r.is_correct === true;
                  const isWrong = r.is_correct === false && r.selected_option !== null;

                  return (
                    <div
                      key={r.response_id || idx}
                      className="p-4 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] space-y-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-[#1D1D1F]">
                          Q{r.question_order}. {r.question_text}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0.5 px-2 shrink-0 rounded-full font-medium ${
                            isCorrect
                              ? "bg-[#34C759]/10 text-[#1E7E34] border-[#34C759]/30"
                              : isWrong
                              ? "bg-[#FF3B30]/10 text-[#D70015] border-[#FF3B30]/30"
                              : "bg-[#E8E8ED] text-[#6E6E73] border-[#D2D2D7]"
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {(["A", "B", "C", "D"] as const).map((optKey) => {
                          const optText = r.options[optKey];
                          if (!optText) return null;
                          const isSelected = r.selected_option?.trim().toUpperCase() === optKey;
                          const isAnswerKey = r.correct_option?.trim().toUpperCase() === optKey;

                          let optClass = "border-[#D2D2D7] bg-white text-[#6E6E73]";
                          if (isAnswerKey) {
                            optClass = "border-[#34C759]/40 bg-[#34C759]/10 text-[#1E7E34] font-medium";
                          } else if (isSelected && !isAnswerKey) {
                            optClass = "border-[#FF3B30]/40 bg-[#FF3B30]/10 text-[#D70015] font-medium";
                          }

                          return (
                            <div
                              key={optKey}
                              className={`p-2.5 rounded-lg border text-[11px] flex items-center justify-between gap-1.5 ${optClass}`}
                            >
                              <span className="truncate">
                                <strong className="mr-1 text-[#1D1D1F]">{optKey}.</strong> {optText}
                              </span>
                              {isAnswerKey && (
                                <span className="text-[9px] text-[#1E7E34] font-bold shrink-0">Correct Key</span>
                              )}
                              {isSelected && !isAnswerKey && (
                                <span className="text-[9px] text-[#D70015] font-bold shrink-0">Candidate Choice</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {r.explanation && (
                        <div className="p-2.5 rounded-lg bg-white border border-[#D2D2D7] text-[11px] text-[#1D1D1F]">
                          <strong className="text-[#0071E3]">Explanation:</strong> {r.explanation}
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
      <footer className="border-t border-[#D2D2D7]/80 bg-white py-4 text-center text-xs text-[#6E6E73]">
        <p>ExamPortal Admin Console • Examination Integrity Reporting</p>
      </footer>
    </div>
  );
}
