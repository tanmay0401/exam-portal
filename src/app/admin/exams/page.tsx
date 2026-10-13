"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  FileText,
  Clock,
  Hash,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
  ExternalLink,
  ShieldAlert,
  Search,
  Sparkles,
  RefreshCw,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ExamItem {
  id: string;
  title: string;
  subject_id: string | null;
  total_questions: number;
  marks_per_question: number;
  negative_marks: number;
  max_marks: number;
  duration_minutes: number;
  batch_count: number;
  allow_question_reuse: boolean;
  status: "draft" | "published" | "closed";
  is_dry_run: boolean;
  exam_link_token: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  subjects?: {
    id: string;
    name: string;
  } | null;
}

export default function ExamsListPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [examToDelete, setExamToDelete] = useState<ExamItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/exams");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch exams");
      }
      const data = await res.json();
      setExams(data.exams || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error fetching exams";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleDeleteExam = async () => {
    if (!examToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/exams/${examToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete exam");
      }
      toast.success("Exam deleted successfully");
      setExams((prev) => prev.filter((e) => e.id !== examToDelete.id));
      setExamToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredExams = exams.filter((exam) => {
    // Status filter
    if (activeTab !== "all" && exam.status !== activeTab) {
      return false;
    }
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = exam.title.toLowerCase().includes(q);
      const subjectMatch = exam.subjects?.name?.toLowerCase().includes(q);
      return titleMatch || subjectMatch;
    }
    return true;
  });

  const getStatusBadge = (status: "draft" | "published" | "closed") => {
    switch (status) {
      case "draft":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <span className="size-1.5 rounded-full bg-slate-400" />
            Draft
          </span>
        );
      case "published":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Published
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <span className="size-1.5 rounded-full bg-rose-400" />
            Closed
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Examination Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure assessment parameters, generate randomized batches, and publish student test sessions.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExams}
            disabled={loading}
            className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25"
          >
            <Link href="/admin/exams/new">
              <Plus className="size-4 mr-1.5" />
              <span>Create Exam</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/40 p-2 rounded-xl border border-slate-800/80">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as string)}
          className="w-full sm:w-auto"
        >
          <TabsList className="bg-slate-950/80 border border-slate-800">
            <TabsTrigger
              value="all"
              className="text-xs data-active:bg-indigo-600 data-active:text-white"
            >
              All ({exams.length})
            </TabsTrigger>
            <TabsTrigger
              value="draft"
              className="text-xs data-active:bg-indigo-600 data-active:text-white"
            >
              Draft ({exams.filter((e) => e.status === "draft").length})
            </TabsTrigger>
            <TabsTrigger
              value="published"
              className="text-xs data-active:bg-indigo-600 data-active:text-white"
            >
              Published ({exams.filter((e) => e.status === "published").length})
            </TabsTrigger>
            <TabsTrigger
              value="closed"
              className="text-xs data-active:bg-indigo-600 data-active:text-white"
            >
              Closed ({exams.filter((e) => e.status === "closed").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 size-3.5 text-slate-500 pointer-events-none" />
          <Input
            placeholder="Search by title or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs bg-slate-950/80 border-slate-800 h-8 text-slate-200 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <Card className="border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 className="size-8 animate-spin text-indigo-500" />
              <p className="text-sm">Loading examinations...</p>
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="py-20 px-4 text-center max-w-md mx-auto space-y-4">
              <div className="size-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                <FileText className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">No examinations found</h3>
                <p className="text-xs text-slate-400">
                  {searchQuery || activeTab !== "all"
                    ? "Try adjusting your filters or search query to find examinations."
                    : "Get started by creating your first online examination with randomized multi-batch papers."}
                </p>
              </div>
              <Link href="/admin/exams/new">
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  <Plus className="size-4 mr-1.5" />
                  <span>Create First Exam</span>
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/60 border-b border-slate-800">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-xs font-semibold text-slate-400">Exam Title</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-400">Subject</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-400">Questions</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-400">Duration</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-400">Type</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-400">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExams.map((exam) => (
                    <TableRow
                      key={exam.id}
                      className="border-slate-800/80 hover:bg-slate-800/40 transition-colors"
                    >
                      <TableCell className="font-medium text-slate-200">
                        <Link
                          href={`/admin/exams/${exam.id}`}
                          className="hover:text-indigo-400 font-semibold transition-colors flex items-center gap-2 group"
                        >
                          <span>{exam.title}</span>
                        </Link>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Batches: {exam.batch_count} • Marks: {exam.total_questions * exam.marks_per_question} max
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-slate-300">
                        {exam.subjects ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300">
                            {exam.subjects.name}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">None assigned</span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-slate-300">
                        <span className="font-mono">{exam.total_questions}</span> questions
                        <span className="text-[10px] text-slate-500 block">
                          +{exam.marks_per_question} / -{exam.negative_marks}
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-slate-300">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Clock className="size-3.5 text-slate-500" />
                          <span>{exam.duration_minutes} mins</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        {exam.is_dry_run ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Sparkles className="size-3 text-amber-400" />
                            Dry Run
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Standard</span>
                        )}
                      </TableCell>

                      <TableCell>{getStatusBadge(exam.status)}</TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/admin/exams/${exam.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                            >
                              <Eye className="size-3.5 mr-1" />
                              <span>Manage</span>
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExamToDelete(exam)}
                            className="h-8 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                          >
                            <Trash2 className="size-3.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!examToDelete} onOpenChange={(open) => !open && setExamToDelete(null)}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-400 text-lg">
              <ShieldAlert className="size-5" />
              <span>Confirm Exam Deletion</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Are you sure you want to delete{" "}
              <strong className="text-white">&quot;{examToDelete?.title}&quot;</strong>? This will permanently remove all associated randomized batches and question mappings. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExamToDelete(null)}
              disabled={isDeleting}
              className="border-slate-800 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteExam}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {isDeleting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Deleting...</span>
                </span>
              ) : (
                <span>Delete Exam</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
