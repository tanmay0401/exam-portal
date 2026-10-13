"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Plus,
  Upload,
  Pencil,
  Trash2,
  Search,
  BookOpen,
  MoreHorizontal,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Download,
  Check,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CorrectOption, QuestionDifficulty } from "@/lib/types/database";

interface QuestionItem {
  id: string;
  subject_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: CorrectOption;
  difficulty: QuestionDifficulty;
  created_by: string | null;
  created_at: string;
}

interface SubjectInfo {
  id: string;
  name: string;
  description: string | null;
}

interface QuestionFormState {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: CorrectOption;
  difficulty: QuestionDifficulty;
}

const initialFormState: QuestionFormState = {
  question_text: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_option: "A",
  difficulty: "medium",
};

export default function QuestionsBankPage() {
  const params = useParams();
  const subjectId = params.id as string;

  const [subject, setSubject] = useState<SubjectInfo | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Active items for forms
  const [formData, setFormData] = useState<QuestionFormState>(initialFormState);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<QuestionItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CSV Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load subject details
  const fetchSubject = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: sbError } = await supabase
        .from("subjects")
        .select("id, name, description")
        .eq("id", subjectId)
        .single();

      if (sbError || !data) {
        // Fallback to fetch all subjects
        const res = await fetch("/api/subjects");
        if (res.ok) {
          const result = await res.json();
          const list: SubjectInfo[] = Array.isArray(result) ? result : result.subjects || [];
          const match = list.find((s) => s.id === subjectId);
          if (match) {
            setSubject(match);
            return;
          }
        }
        setError("Subject not found");
      } else {
        setSubject(data);
      }
    } catch (err: any) {
      console.error("Error fetching subject:", err);
    }
  }, [subjectId]);

  // Load questions
  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions?subject_id=${encodeURIComponent(subjectId)}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load questions");
      }
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : data.questions || []);
    } catch (err: any) {
      const msg = err.message || "Failed to fetch question bank";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    fetchSubject();
    fetchQuestions();
  }, [fetchSubject, fetchQuestions]);

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesSearch =
        !searchQuery.trim() ||
        q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.option_a.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.option_b.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.option_c.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.option_d.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDiff =
        selectedDifficulty === "all" || q.difficulty === selectedDifficulty;

      return matchesSearch && matchesDiff;
    });
  }, [questions, searchQuery, selectedDifficulty]);

  // Handle open add modal
  const handleOpenAdd = () => {
    setFormData(initialFormState);
    setIsAddOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (question: QuestionItem) => {
    setEditingQuestion(question);
    setFormData({
      question_text: question.question_text,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_option: question.correct_option,
      difficulty: question.difficulty,
    });
    setIsEditOpen(true);
  };

  // Handle open delete modal
  const handleOpenDelete = (question: QuestionItem) => {
    setDeletingQuestion(question);
    setIsDeleteOpen(true);
  };

  // Handle open import modal
  const handleOpenImport = () => {
    setCsvFile(null);
    setImportSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsImportOpen(true);
  };

  // Create Question
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question_text.trim()) {
      toast.error("Please enter the question text");
      return;
    }
    if (
      !formData.option_a.trim() ||
      !formData.option_b.trim() ||
      !formData.option_c.trim() ||
      !formData.option_d.trim()
    ) {
      toast.error("All four options (A, B, C, D) are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: subjectId,
          ...formData,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create question");
      }

      toast.success("Question created successfully!");
      setIsAddOpen(false);
      setFormData(initialFormState);
      fetchQuestions();
    } catch (err: any) {
      toast.error(err.message || "Failed to create question");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Question
  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    if (!formData.question_text.trim()) {
      toast.error("Please enter the question text");
      return;
    }
    if (
      !formData.option_a.trim() ||
      !formData.option_b.trim() ||
      !formData.option_c.trim() ||
      !formData.option_d.trim()
    ) {
      toast.error("All four options (A, B, C, D) are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/questions/${editingQuestion.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update question");
      }

      toast.success("Question updated successfully!");
      setIsEditOpen(false);
      setEditingQuestion(null);
      fetchQuestions();
    } catch (err: any) {
      toast.error(err.message || "Failed to update question");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Question
  const handleDeleteQuestion = async () => {
    if (!deletingQuestion) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/questions/${deletingQuestion.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete question");
      }

      toast.success("Question removed from bank!");
      setIsDeleteOpen(false);
      setDeletingQuestion(null);
      fetchQuestions();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete question");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Import CSV
  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      toast.error("Please select a CSV file to upload");
      return;
    }

    setIsImporting(true);
    setImportSummary(null);

    try {
      const body = new FormData();
      body.append("file", csvFile);
      body.append("subject_id", subjectId);

      const res = await fetch("/api/questions/import", {
        method: "POST",
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import CSV");
      }

      setImportSummary({
        imported: data.imported ?? 0,
        skipped: data.skipped ?? 0,
        errors: data.errors ?? [],
      });

      if (data.imported > 0) {
        toast.success(`Successfully imported ${data.imported} questions!`);
        fetchQuestions();
      } else {
        toast.warning("No questions were imported. Please check CSV format.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to import CSV");
    } finally {
      setIsImporting(false);
    }
  };

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const csvContent =
      "question_text,option_a,option_b,option_c,option_d,correct_option,difficulty\n" +
      '"What is the primary function of DNS?","Converts domain names to IP addresses","Encrypts HTTP traffic","Manages hardware drivers","Stores database queries","A","easy"\n' +
      '"What is the time complexity of searching in a balanced Binary Search Tree?","O(1)","O(n)","O(log n)","O(n log n)","C","medium"\n' +
      '"Which consensus algorithm is used in Bitcoin?","Proof of Stake","Proof of Work","Raft","Paxos","B","hard"';

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `question_import_sample_${subject?.name || "template"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Render difficulty badge
  const renderDifficultyBadge = (diff: QuestionDifficulty) => {
    switch (diff) {
      case "easy":
        return (
          <Badge
            variant="secondary"
            className="bg-[#34C759]/10 text-[#1E7E34] border border-[#34C759]/30 capitalize font-medium text-[11px]"
          >
            Easy
          </Badge>
        );
      case "medium":
        return (
          <Badge
            variant="secondary"
            className="bg-[#FF9500]/10 text-[#B25E00] border border-[#FF9500]/30 capitalize font-medium text-[11px]"
          >
            Medium
          </Badge>
        );
      case "hard":
        return (
          <Badge
            variant="secondary"
            className="bg-[#FF3B30]/10 text-[#D70015] border border-[#FF3B30]/30 capitalize font-medium text-[11px]"
          >
            Hard
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="capitalize text-[11px] border-[#D2D2D7] text-[#6E6E73]">
            {diff}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#6E6E73]">
        <Link
          href="/admin/subjects"
          className="hover:text-[#1D1D1F] transition-colors inline-flex items-center gap-1 font-medium"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Subjects</span>
        </Link>
        <span>/</span>
        <span className="text-[#1D1D1F] font-medium">Question Bank</span>
      </div>

      {/* Header section with Subject Name & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F] flex items-center gap-2.5">
              <BookOpen className="size-7 text-[#0071E3] shrink-0" />
              <span>{subject ? subject.name : "Loading Subject..."}</span>
            </h1>
          </div>
          <p className="text-sm text-[#6E6E73] mt-1 max-w-2xl">
            {subject?.description || "Manage questions, multiple choice options, and difficulty levels for this subject."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={handleOpenImport}
            className="border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs h-9 font-medium shadow-sm"
          >
            <Upload className="size-3.5 mr-1.5 text-[#0071E3]" />
            <span>Import CSV</span>
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium shadow-sm text-xs h-9 transition-colors"
          >
            <Plus className="size-3.5 mr-1.5" />
            <span>Add Question</span>
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive" className="border-[#FF3B30]/30 bg-[#FF3B30]/10 text-[#D70015]">
          <AlertCircle className="size-4 text-[#FF3B30]" />
          <AlertDescription className="text-xs sm:text-sm font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Card with filters & questions table */}
      <Card className="border-[#D2D2D7] bg-white shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-[#D2D2D7] bg-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg font-semibold text-[#1D1D1F]">
                Questions Bank ({questions.length})
              </CardTitle>
              <CardDescription className="text-xs text-[#6E6E73] mt-0.5">
                Questions configured for dynamic examination batch generation.
              </CardDescription>
            </div>

            {/* Search and Difficulty Filter Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#86868B] pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search questions or options..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-xs placeholder:text-[#86868B] focus-visible:bg-white focus-visible:border-[#0071E3] focus-visible:ring-1 focus-visible:ring-[#0071E3] rounded-lg"
                />
              </div>

              {/* Difficulty Filter */}
              <div className="w-full sm:w-44">
                <Select
                  value={selectedDifficulty}
                  onValueChange={(val) => setSelectedDifficulty(val as string)}
                >
                  <SelectTrigger className="h-9 w-full bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-xs rounded-lg">
                    <SelectValue placeholder="All Difficulties" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#D2D2D7] text-[#1D1D1F] text-xs shadow-md">
                    <SelectItem value="all">All Difficulties</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            /* Skeleton Loading State */
            <div className="p-4 sm:p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col gap-2 py-3 border-b border-[#D2D2D7]/60">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-2/3 bg-[#E8E8ED]" />
                    <Skeleton className="h-6 w-16 bg-[#E8E8ED] rounded-full" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <Skeleton className="h-4 bg-[#E8E8ED]/70 rounded" />
                    <Skeleton className="h-4 bg-[#E8E8ED]/70 rounded" />
                    <Skeleton className="h-4 bg-[#E8E8ED]/70 rounded" />
                    <Skeleton className="h-4 bg-[#E8E8ED]/70 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredQuestions.length === 0 ? (
            /* Empty State */
            <div className="py-16 px-4 text-center">
              <div className="size-14 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="size-7" />
              </div>
              <h3 className="text-base font-semibold text-[#1D1D1F] mb-1">
                {searchQuery || selectedDifficulty !== "all"
                  ? "No matching questions found"
                  : "No questions in this repository yet"}
              </h3>
              <p className="text-xs sm:text-sm text-[#6E6E73] max-w-sm mx-auto mb-6">
                {searchQuery || selectedDifficulty !== "all"
                  ? "Try resetting your search query or difficulty filter."
                  : "Add questions individually with full options or upload a batch via CSV."}
              </p>
              {searchQuery || selectedDifficulty !== "all" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedDifficulty("all");
                  }}
                  className="border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#F5F5F7] text-xs font-medium"
                >
                  Reset Filters
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <Button
                    onClick={handleOpenAdd}
                    className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs h-9 font-medium"
                  >
                    <Plus className="size-3.5 mr-1.5" />
                    <span>Add Question</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleOpenImport}
                    className="border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] text-xs h-9 font-medium"
                  >
                    <Upload className="size-3.5 mr-1.5 text-[#0071E3]" />
                    <span>Import CSV</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Questions Table */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#F5F5F7]/80 border-b border-[#D2D2D7]">
                  <TableRow className="border-[#D2D2D7] hover:bg-transparent">
                    <TableHead className="text-[#6E6E73] text-xs font-semibold py-3 px-4 w-12 text-center">
                      #
                    </TableHead>
                    <TableHead className="text-[#6E6E73] text-xs font-semibold py-3 px-4 min-w-[280px]">
                      Question Text & Options
                    </TableHead>
                    <TableHead className="text-[#6E6E73] text-xs font-semibold py-3 px-4 text-center w-28">
                      Correct Key
                    </TableHead>
                    <TableHead className="text-[#6E6E73] text-xs font-semibold py-3 px-4 text-center w-28">
                      Difficulty
                    </TableHead>
                    <TableHead className="text-[#6E6E73] text-xs font-semibold py-3 px-4 text-right w-20">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuestions.map((q, idx) => (
                    <TableRow
                      key={q.id}
                      className="border-b border-[#D2D2D7]/60 hover:bg-[#F5F5F7]/60 transition-colors"
                    >
                      {/* Row index */}
                      <TableCell className="py-4 px-4 text-center text-xs text-[#86868B] font-mono">
                        {idx + 1}
                      </TableCell>

                      {/* Question text and options */}
                      <TableCell className="py-4 px-4">
                        <div className="space-y-2.5">
                          <p className="text-sm font-medium text-[#1D1D1F] line-clamp-2 leading-snug">
                            {q.question_text}
                          </p>

                          {/* Options grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                            <div
                              className={`p-1.5 rounded-lg border flex items-center gap-2 ${
                                q.correct_option === "A"
                                  ? "bg-[#34C759]/10 border-[#34C759]/30 text-[#1E7E34] font-medium"
                                  : "bg-[#F5F5F7] border-[#D2D2D7] text-[#424245]"
                              }`}
                            >
                              <span
                                className={`size-5 rounded font-bold text-[10px] flex items-center justify-center shrink-0 ${
                                  q.correct_option === "A"
                                    ? "bg-[#34C759] text-white"
                                    : "bg-[#E8E8ED] text-[#6E6E73]"
                                }`}
                              >
                                A
                              </span>
                              <span className="truncate">{q.option_a}</span>
                            </div>

                            <div
                              className={`p-1.5 rounded-lg border flex items-center gap-2 ${
                                q.correct_option === "B"
                                  ? "bg-[#34C759]/10 border-[#34C759]/30 text-[#1E7E34] font-medium"
                                  : "bg-[#F5F5F7] border-[#D2D2D7] text-[#424245]"
                              }`}
                            >
                              <span
                                className={`size-5 rounded font-bold text-[10px] flex items-center justify-center shrink-0 ${
                                  q.correct_option === "B"
                                    ? "bg-[#34C759] text-white"
                                    : "bg-[#E8E8ED] text-[#6E6E73]"
                                }`}
                              >
                                B
                              </span>
                              <span className="truncate">{q.option_b}</span>
                            </div>

                            <div
                              className={`p-1.5 rounded-lg border flex items-center gap-2 ${
                                q.correct_option === "C"
                                  ? "bg-[#34C759]/10 border-[#34C759]/30 text-[#1E7E34] font-medium"
                                  : "bg-[#F5F5F7] border-[#D2D2D7] text-[#424245]"
                              }`}
                            >
                              <span
                                className={`size-5 rounded font-bold text-[10px] flex items-center justify-center shrink-0 ${
                                  q.correct_option === "C"
                                    ? "bg-[#34C759] text-white"
                                    : "bg-[#E8E8ED] text-[#6E6E73]"
                                }`}
                              >
                                C
                              </span>
                              <span className="truncate">{q.option_c}</span>
                            </div>

                            <div
                              className={`p-1.5 rounded-lg border flex items-center gap-2 ${
                                q.correct_option === "D"
                                  ? "bg-[#34C759]/10 border-[#34C759]/30 text-[#1E7E34] font-medium"
                                  : "bg-[#F5F5F7] border-[#D2D2D7] text-[#424245]"
                              }`}
                            >
                              <span
                                className={`size-5 rounded font-bold text-[10px] flex items-center justify-center shrink-0 ${
                                  q.correct_option === "D"
                                    ? "bg-[#34C759] text-white"
                                    : "bg-[#E8E8ED] text-[#6E6E73]"
                                }`}
                              >
                                D
                              </span>
                              <span className="truncate">{q.option_d}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Correct Option Badge */}
                      <TableCell className="py-4 px-4 text-center">
                        <Badge
                          variant="secondary"
                          className="bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/30 font-semibold text-xs px-2.5 py-0.5"
                        >
                          Option {q.correct_option}
                        </Badge>
                      </TableCell>

                      {/* Difficulty Badge */}
                      <TableCell className="py-4 px-4 text-center">
                        {renderDifficultyBadge(q.difficulty)}
                      </TableCell>

                      {/* Row Actions */}
                      <TableCell className="py-4 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]"
                              >
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Question options</span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent
                            align="end"
                            className="w-40 bg-white border-[#D2D2D7] text-[#1D1D1F] shadow-lg"
                          >
                            <DropdownMenuItem
                              className="cursor-pointer text-xs focus:bg-[#F5F5F7] focus:text-[#1D1D1F]"
                              onClick={() => handleOpenEdit(q)}
                            >
                              <Pencil className="size-3.5 mr-2 text-[#FF9500]" />
                              <span>Edit Question</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[#D2D2D7]" />
                            <DropdownMenuItem
                              className="cursor-pointer text-xs text-[#FF3B30] focus:bg-[#FF3B30]/10 focus:text-[#D70015]"
                              onClick={() => handleOpenDelete(q)}
                            >
                              <Trash2 className="size-3.5 mr-2 text-[#FF3B30]" />
                              <span>Delete Question</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE QUESTION DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-white border border-[#D2D2D7] text-[#1D1D1F] sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl">
          <form onSubmit={handleCreateQuestion}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1D1D1F] flex items-center gap-2">
                <Plus className="size-5 text-[#0071E3]" />
                <span>Add Question to Bank</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6E6E73]">
                Specify question content, 4 multiple choice choices, correct answer key, and difficulty.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Question Text */}
              <div className="space-y-1.5">
                <Label htmlFor="q-text" className="text-xs font-semibold text-[#1D1D1F]">
                  Question Text <span className="text-[#FF3B30]">*</span>
                </Label>
                <Textarea
                  id="q-text"
                  placeholder="Enter the question prompt or problem statement..."
                  value={formData.question_text}
                  onChange={(e) =>
                    setFormData({ ...formData, question_text: e.target.value })
                  }
                  rows={3}
                  className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm focus-visible:bg-white focus-visible:border-[#0071E3] rounded-lg"
                  required
                  autoFocus
                />
              </div>

              {/* Options A & B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="opt-a" className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                    <span className="size-4 rounded bg-[#0071E3]/15 text-[#0071E3] text-[10px] flex items-center justify-center font-bold">
                      A
                    </span>
                    <span>Option A</span>
                    <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Input
                    id="opt-a"
                    placeholder="Value for Option A"
                    value={formData.option_a}
                    onChange={(e) =>
                      setFormData({ ...formData, option_a: e.target.value })
                    }
                    className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm focus-visible:bg-white focus-visible:border-[#0071E3] rounded-lg"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="opt-b" className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                    <span className="size-4 rounded bg-[#0071E3]/15 text-[#0071E3] text-[10px] flex items-center justify-center font-bold">
                      B
                    </span>
                    <span>Option B</span>
                    <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Input
                    id="opt-b"
                    placeholder="Value for Option B"
                    value={formData.option_b}
                    onChange={(e) =>
                      setFormData({ ...formData, option_b: e.target.value })
                    }
                    className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm focus-visible:bg-white focus-visible:border-[#0071E3] rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* Options C & D */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="opt-c" className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                    <span className="size-4 rounded bg-[#0071E3]/15 text-[#0071E3] text-[10px] flex items-center justify-center font-bold">
                      C
                    </span>
                    <span>Option C</span>
                    <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Input
                    id="opt-c"
                    placeholder="Value for Option C"
                    value={formData.option_c}
                    onChange={(e) =>
                      setFormData({ ...formData, option_c: e.target.value })
                    }
                    className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm focus-visible:bg-white focus-visible:border-[#0071E3] rounded-lg"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="opt-d" className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                    <span className="size-4 rounded bg-[#0071E3]/15 text-[#0071E3] text-[10px] flex items-center justify-center font-bold">
                      D
                    </span>
                    <span>Option D</span>
                    <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Input
                    id="opt-d"
                    placeholder="Value for Option D"
                    value={formData.option_d}
                    onChange={(e) =>
                      setFormData({ ...formData, option_d: e.target.value })
                    }
                    className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm focus-visible:bg-white focus-visible:border-[#0071E3] rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* Correct Option and Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="correct-opt" className="text-xs font-semibold text-[#1D1D1F]">
                    Correct Answer Key <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Select
                    value={formData.correct_option}
                    onValueChange={(val) =>
                      setFormData({
                        ...formData,
                        correct_option: val as CorrectOption,
                      })
                    }
                  >
                    <SelectTrigger id="correct-opt" className="h-9 w-full bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm rounded-lg">
                      <SelectValue placeholder="Select correct option" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#D2D2D7] text-[#1D1D1F]">
                      <SelectItem value="A">Option A</SelectItem>
                      <SelectItem value="B">Option B</SelectItem>
                      <SelectItem value="C">Option C</SelectItem>
                      <SelectItem value="D">Option D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="difficulty" className="text-xs font-semibold text-[#1D1D1F]">
                    Difficulty Level <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Select
                    value={formData.difficulty}
                    onValueChange={(val) =>
                      setFormData({
                        ...formData,
                        difficulty: val as QuestionDifficulty,
                      })
                    }
                  >
                    <SelectTrigger id="difficulty" className="h-9 w-full bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm rounded-lg">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#D2D2D7] text-[#1D1D1F]">
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="bg-[#F5F5F7]/80 -mx-6 -mb-6 p-4 rounded-b-2xl border-t border-[#D2D2D7] gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                disabled={isSubmitting}
                className="border-[#D2D2D7] text-[#1D1D1F] hover:bg-white text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    <span>Saving Question...</span>
                  </>
                ) : (
                  <span>Add Question</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT QUESTION DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-white border border-[#D2D2D7] text-[#1D1D1F] sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl">
          <form onSubmit={handleUpdateQuestion}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1D1D1F] flex items-center gap-2">
                <Pencil className="size-5 text-[#FF9500]" />
                <span>Edit Question</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6E6E73]">
                Update prompt, options, answer key, or difficulty.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Question Text */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-q-text" className="text-xs font-semibold text-[#1D1D1F]">
                  Question Text <span className="text-[#FF3B30]">*</span>
                </Label>
                <Textarea
                  id="edit-q-text"
                  value={formData.question_text}
                  onChange={(e) =>
                    setFormData({ ...formData, question_text: e.target.value })
                  }
                  rows={3}
                  className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm focus-visible:bg-white focus-visible:border-[#0071E3] rounded-lg"
                  required
                />
              </div>

              {/* Options A & B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-opt-a" className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                    <span className="size-4 rounded bg-[#0071E3]/15 text-[#0071E3] text-[10px] flex items-center justify-center font-bold">
                      A
                    </span>
                    <span>Option A</span>
                    <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Input
                    id="edit-opt-a"
                    value={formData.option_a}
                    onChange={(e) =>
                      setFormData({ ...formData, option_a: e.target.value })
                    }
                    className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm focus-visible:bg-white focus-visible:border-[#0071E3] rounded-lg"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-opt-b" className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                    <span className="size-4 rounded bg-[#0071E3]/15 text-[#0071E3] text-[10px] flex items-center justify-center font-bold">
                      B
                    </span>
                    <span>Option B</span>
                    <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Input
                    id="edit-opt-b"
                    value={formData.option_b}
                    onChange={(e) =>
                      setFormData({ ...formData, option_b: e.target.value })
                    }
                    className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm focus-visible:bg-white focus-visible:border-[#0071E3] rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* Options C & D */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-opt-c" className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                    <span className="size-4 rounded bg-[#0071E3]/15 text-[#0071E3] text-[10px] flex items-center justify-center font-bold">
                      C
                    </span>
                    <span>Option C</span>
                    <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Input
                    id="edit-opt-c"
                    value={formData.option_c}
                    onChange={(e) =>
                      setFormData({ ...formData, option_c: e.target.value })
                    }
                    className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm focus-visible:bg-white focus-visible:border-[#0071E3] rounded-lg"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-opt-d" className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                    <span className="size-4 rounded bg-[#0071E3]/15 text-[#0071E3] text-[10px] flex items-center justify-center font-bold">
                      D
                    </span>
                    <span>Option D</span>
                    <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Input
                    id="edit-opt-d"
                    value={formData.option_d}
                    onChange={(e) =>
                      setFormData({ ...formData, option_d: e.target.value })
                    }
                    className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm focus-visible:bg-white focus-visible:border-[#0071E3] rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* Correct Option and Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-correct-opt" className="text-xs font-semibold text-[#1D1D1F]">
                    Correct Answer Key <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Select
                    value={formData.correct_option}
                    onValueChange={(val) =>
                      setFormData({
                        ...formData,
                        correct_option: val as CorrectOption,
                      })
                    }
                  >
                    <SelectTrigger id="edit-correct-opt" className="h-9 w-full bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm rounded-lg">
                      <SelectValue placeholder="Select correct option" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#D2D2D7] text-[#1D1D1F]">
                      <SelectItem value="A">Option A</SelectItem>
                      <SelectItem value="B">Option B</SelectItem>
                      <SelectItem value="C">Option C</SelectItem>
                      <SelectItem value="D">Option D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-diff" className="text-xs font-semibold text-[#1D1D1F]">
                    Difficulty Level <span className="text-[#FF3B30]">*</span>
                  </Label>
                  <Select
                    value={formData.difficulty}
                    onValueChange={(val) =>
                      setFormData({
                        ...formData,
                        difficulty: val as QuestionDifficulty,
                      })
                    }
                  >
                    <SelectTrigger id="edit-diff" className="h-9 w-full bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] text-sm rounded-lg">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#D2D2D7] text-[#1D1D1F]">
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="bg-[#F5F5F7]/80 -mx-6 -mb-6 p-4 rounded-b-2xl border-t border-[#D2D2D7] gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
                className="border-[#D2D2D7] text-[#1D1D1F] hover:bg-white text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    <span>Updating Question...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-white border border-[#D2D2D7] text-[#1D1D1F] sm:max-w-md rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#FF3B30] flex items-center gap-2">
              <Trash2 className="size-5" />
              <span>Delete Question</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6E6E73]">
              Are you sure you want to permanently remove this question from the bank?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <div className="p-3 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-xs text-[#1D1D1F] font-medium">
              &quot;{deletingQuestion?.question_text}&quot;
            </div>

            <div className="text-xs text-[#D70015] bg-[#FF3B30]/10 border border-[#FF3B30]/20 p-2.5 rounded-xl flex items-start gap-2">
              <AlertCircle className="size-4 text-[#FF3B30] shrink-0 mt-0.5" />
              <span>This question will not be included in future exam batch generation.</span>
            </div>
          </div>

          <DialogFooter className="bg-[#F5F5F7]/80 -mx-6 -mb-6 p-4 rounded-b-2xl border-t border-[#D2D2D7] gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isSubmitting}
              className="border-[#D2D2D7] text-[#1D1D1F] hover:bg-white text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDeleteQuestion}
              disabled={isSubmitting}
              className="bg-[#FF3B30] hover:bg-[#D70015] text-white text-xs font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Question</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV IMPORT DIALOG */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="bg-white border border-[#D2D2D7] text-[#1D1D1F] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl">
          <form onSubmit={handleImportCsv}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#1D1D1F] flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-[#0071E3]" />
                <span>Import Questions via CSV</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6E6E73]">
                Bulk upload multiple choice questions for &quot;{subject?.name}&quot;.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Template Download Prompt */}
              <div className="p-3.5 rounded-xl border border-[#0071E3]/20 bg-[#0071E3]/5 flex items-center justify-between gap-3">
                <div className="text-xs text-[#1D1D1F]">
                  <span className="font-semibold block text-[#1D1D1F]">Need a CSV template?</span>
                  Download the sample template with pre-configured headers and example rows.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSampleCsv}
                  className="shrink-0 h-8 text-xs border-[#0071E3]/30 text-[#0071E3] hover:text-white hover:bg-[#0071E3] font-medium"
                >
                  <Download className="size-3 mr-1" />
                  <span>Sample CSV</span>
                </Button>
              </div>

              {/* Required Columns Guide */}
              <div className="p-3.5 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] text-xs space-y-1.5 text-[#6E6E73]">
                <span className="font-semibold text-[#1D1D1F] block">Required CSV Column Headers:</span>
                <div className="flex flex-wrap gap-1 font-mono text-[11px] text-[#1D1D1F]">
                  <code className="bg-[#E8E8ED] px-1.5 py-0.5 rounded text-[#0071E3]">question_text</code>
                  <code className="bg-[#E8E8ED] px-1.5 py-0.5 rounded text-[#0071E3]">option_a</code>
                  <code className="bg-[#E8E8ED] px-1.5 py-0.5 rounded text-[#0071E3]">option_b</code>
                  <code className="bg-[#E8E8ED] px-1.5 py-0.5 rounded text-[#0071E3]">option_c</code>
                  <code className="bg-[#E8E8ED] px-1.5 py-0.5 rounded text-[#0071E3]">option_d</code>
                  <code className="bg-[#E8E8ED] px-1.5 py-0.5 rounded text-[#0071E3]">correct_option</code>
                  <code className="bg-[#E8E8ED] px-1.5 py-0.5 rounded text-[#0071E3]">difficulty</code>
                </div>
                <p className="text-[11px] text-[#86868B] pt-1">
                  * <span className="text-[#1D1D1F]">correct_option</span> must be A, B, C, or D.
                  * <span className="text-[#1D1D1F]">difficulty</span> can be easy, medium, or hard.
                </p>
              </div>

              {/* File input */}
              <div className="space-y-1.5">
                <Label htmlFor="csv-file-input" className="text-xs font-semibold text-[#1D1D1F]">
                  Select CSV File <span className="text-[#FF3B30]">*</span>
                </Label>
                <Input
                  id="csv-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setCsvFile(file);
                    setImportSummary(null);
                  }}
                  className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] file:text-[#0071E3] file:bg-[#E8E8ED] file:hover:bg-[#D2D2D7] file:border-0 file:rounded-md file:text-xs file:font-medium text-xs cursor-pointer rounded-lg"
                />
              </div>

              {/* Import Results Summary if available */}
              {importSummary && (
                <div className="space-y-2 pt-1">
                  <div className="p-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] text-xs space-y-1">
                    <div className="flex items-center gap-2 text-[#1E7E34] font-semibold">
                      <CheckCircle2 className="size-4 text-[#34C759]" />
                      <span>{importSummary.imported} Questions Imported Successfully</span>
                    </div>
                    {importSummary.skipped > 0 && (
                      <div className="flex items-center gap-2 text-[#B25E00] font-semibold pt-1">
                        <AlertCircle className="size-4 text-[#FF9500]" />
                        <span>{importSummary.skipped} Questions Skipped (Validation Errors)</span>
                      </div>
                    )}
                  </div>

                  {importSummary.errors.length > 0 && (
                    <div className="p-2.5 rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/10 text-xs text-[#D70015] max-h-36 overflow-y-auto space-y-1">
                      <div className="font-semibold text-[#D70015]">Error Details:</div>
                      {importSummary.errors.map((err, i) => (
                        <div key={i} className="text-[11px] text-[#D70015] font-mono">
                          • {err}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="bg-[#F5F5F7]/80 -mx-6 -mb-6 p-4 rounded-b-2xl border-t border-[#D2D2D7] gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsImportOpen(false)}
                disabled={isImporting}
                className="border-[#D2D2D7] text-[#1D1D1F] hover:bg-white text-xs font-medium"
              >
                Close
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isImporting || !csvFile}
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    <span>Parsing & Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5 mr-1.5" />
                    <span>Upload & Import</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
