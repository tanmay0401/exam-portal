"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  FileText,
  Clock,
  Loader2,
  Trash2,
  Eye,
  Search,
  RefreshCw,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  starts_at: string | null;
  ends_at: string | null;
  is_dry_run: boolean;
  published_at: string | null;
  created_at: string;
  subjects: {
    id: string;
    name: string;
  } | null;
}

export default function AdminExamsPage() {
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
        throw new Error("Failed to fetch exams");
      }
      const data = await res.json();
      const examList = Array.isArray(data) ? data : (data.exams || []);
      setExams(examList);
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
      toast.success(`Exam "${examToDelete.title}" deleted.`);
      setExams((prev) => (Array.isArray(prev) ? prev.filter((e) => e.id !== examToDelete.id) : []));
      setExamToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting exam";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const safeExams = Array.isArray(exams) ? exams : [];

  const filteredExams = safeExams.filter((exam) => {
    if (activeTab === "draft" && exam.status !== "draft") return false;
    if (activeTab === "published" && exam.status !== "published") return false;
    if (activeTab === "closed" && exam.status !== "closed") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = exam.title?.toLowerCase().includes(q);
      const subjectMatch = exam.subjects?.name?.toLowerCase().includes(q);
      return Boolean(titleMatch || subjectMatch);
    }
    return true;
  });

  const getStatusBadge = (status: "draft" | "published" | "closed") => {
    switch (status) {
      case "draft":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E8E8ED] text-[#6E6E73] border border-[#D2D2D7]">
            <span className="size-1.5 rounded-full bg-[#86868B]" />
            Draft
          </span>
        );
      case "published":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#34C759]/10 text-[#1E7E34] border border-[#34C759]/30">
            <span className="size-1.5 rounded-full bg-[#34C759]" />
            Published
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FF3B30]/10 text-[#D70015] border border-[#FF3B30]/30">
            <span className="size-1.5 rounded-full bg-[#FF3B30]" />
            Closed
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
            Examinations
          </h1>
          <p className="text-[13px] text-[#6E6E73] mt-0.5">
            Configure assessment rules, generate multi-batch randomized papers, and inspect test sessions.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExams}
            disabled={loading}
            className="border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] text-[13px] h-9 rounded-xl shadow-xs"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin text-[#0071E3]" : "text-[#6E6E73]"}`} />
            <span>Refresh</span>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium h-9 px-4 rounded-xl shadow-xs"
          >
            <Link href="/admin/exams/new">
              <Plus className="size-4 mr-1.5" />
              <span>Create Exam</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-[#D2D2D7] shadow-xs">
        {/* Segmented Filter Pills */}
        <div className="flex items-center gap-1 p-1 bg-[#E8E8ED] rounded-xl text-[12px] font-medium">
          {[
            { id: "all", label: `All (${safeExams.length})` },
            { id: "draft", label: `Draft (${safeExams.filter((e) => e.status === "draft").length})` },
            { id: "published", label: `Published (${safeExams.filter((e) => e.status === "published").length})` },
            { id: "closed", label: `Closed (${safeExams.filter((e) => e.status === "closed").length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === tab.id
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 size-3.5 text-[#86868B] pointer-events-none" />
          <Input
            placeholder="Search by title or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-[13px] bg-[#F5F5F7] border-[#D2D2D7] h-8.5 rounded-xl text-[#1D1D1F] placeholder:text-[#86868B] focus-visible:bg-white focus-visible:border-[#0071E3]"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-[#D2D2D7] rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#6E6E73] space-y-2">
            <Loader2 className="size-6 animate-spin text-[#0071E3]" />
            <p className="text-[13px]">Loading examinations...</p>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="py-20 px-4 text-center max-w-md mx-auto space-y-3">
            <div className="size-11 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] text-[#6E6E73] flex items-center justify-center mx-auto">
              <FileText className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[15px] font-semibold text-[#1D1D1F]">No examinations found</h3>
              <p className="text-[12px] text-[#6E6E73]">
                {searchQuery || activeTab !== "all"
                  ? "Try adjusting your filters or search query."
                  : "Create your first online examination with randomized multi-batch papers."}
              </p>
            </div>
            <Link href="/admin/exams/new">
              <Button size="sm" className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-[12px] rounded-xl mt-1">
                <Plus className="size-3.5 mr-1" />
                <span>Create Exam</span>
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#F5F5F7]/80 border-b border-[#D2D2D7]">
                <TableRow className="border-[#D2D2D7] hover:bg-transparent">
                  <TableHead className="text-[12px] font-medium text-[#6E6E73]">Exam Title</TableHead>
                  <TableHead className="text-[12px] font-medium text-[#6E6E73]">Subject</TableHead>
                  <TableHead className="text-[12px] font-medium text-[#6E6E73]">Questions & Marks</TableHead>
                  <TableHead className="text-[12px] font-medium text-[#6E6E73]">Duration</TableHead>
                  <TableHead className="text-[12px] font-medium text-[#6E6E73]">Status</TableHead>
                  <TableHead className="text-[12px] font-medium text-[#6E6E73] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExams.map((exam) => (
                  <TableRow
                    key={exam.id}
                    className="border-b border-[#E5E5EA] hover:bg-[#F5F5F7]/50 transition-colors"
                  >
                    <TableCell className="font-medium text-[#1D1D1F]">
                      <Link
                        href={`/admin/exams/${exam.id}`}
                        className="hover:text-[#0071E3] font-semibold text-[14px] transition-colors block"
                      >
                        {exam.title}
                      </Link>
                      <div className="text-[11px] text-[#6E6E73] mt-0.5">
                        Batches: {exam.batch_count} • Max Marks: {exam.total_questions * exam.marks_per_question}
                      </div>
                    </TableCell>

                    <TableCell className="text-[13px] text-[#1D1D1F]">
                      {exam.subjects ? (
                        <span className="px-2 py-0.5 rounded-md bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] text-[12px]">
                          {exam.subjects.name}
                        </span>
                      ) : (
                        <span className="text-[#86868B] italic text-[12px]">None</span>
                      )}
                    </TableCell>

                    <TableCell className="text-[13px] text-[#1D1D1F]">
                      <span className="font-semibold">{exam.total_questions}</span> Qs
                      <span className="text-[11px] text-[#6E6E73] block">
                        +{exam.marks_per_question} / -{exam.negative_marks}
                      </span>
                    </TableCell>

                    <TableCell className="text-[13px] text-[#1D1D1F]">
                      <div className="flex items-center gap-1.5 text-[#6E6E73] text-[12px]">
                        <Clock className="size-3 text-[#86868B]" />
                        <span>{exam.duration_minutes} mins</span>
                      </div>
                    </TableCell>

                    <TableCell>{getStatusBadge(exam.status)}</TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/admin/exams/${exam.id}/results`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-[12px] text-[#1E7E34] hover:bg-[#34C759]/10 rounded-lg"
                          >
                            <BarChart3 className="size-3.5 mr-1" />
                            <span>Results</span>
                          </Button>
                        </Link>
                        <Link href={`/admin/exams/${exam.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-[12px] text-[#0071E3] hover:bg-[#0071E3]/10 rounded-lg"
                          >
                            <Eye className="size-3.5 mr-1" />
                            <span>Manage</span>
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExamToDelete(exam)}
                          className="h-7 px-2 text-[12px] text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-lg"
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
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!examToDelete} onOpenChange={(open) => !open && setExamToDelete(null)}>
        <DialogContent className="border-[#D2D2D7] bg-white text-[#1D1D1F] sm:max-w-md rounded-2xl p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#D70015] text-[16px]">
              <AlertCircle className="size-5" />
              <span>Confirm Exam Deletion</span>
            </DialogTitle>
            <DialogDescription className="text-[#6E6E73] text-[13px] pt-1 leading-relaxed">
              Are you sure you want to delete <strong className="text-[#1D1D1F]">&quot;{examToDelete?.title}&quot;</strong>? This will permanently remove all generated randomized batches and answer sheets.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExamToDelete(null)}
              disabled={isDeleting}
              className="border-[#D2D2D7] bg-white text-[#1D1D1F] rounded-xl text-[12px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteExam}
              disabled={isDeleting}
              className="bg-[#FF3B30] hover:bg-[#E03126] text-white rounded-xl text-[12px]"
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
