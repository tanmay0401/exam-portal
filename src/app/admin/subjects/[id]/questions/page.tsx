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
            className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize font-medium text-[11px]"
          >
            Easy
          </Badge>
        );
      case "medium":
        return (
          <Badge
            variant="secondary"
            className="bg-amber-500/10 text-amber-400 border border-amber-500/20 capitalize font-medium text-[11px]"
          >
            Medium
          </Badge>
        );
      case "hard":
        return (
          <Badge
            variant="secondary"
            className="bg-rose-500/10 text-rose-400 border border-rose-500/20 capitalize font-medium text-[11px]"
          >
            Hard
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="capitalize text-[11px]">
            {diff}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link
          href="/admin/subjects"
          className="hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Subjects</span>
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-medium">Question Bank</span>
      </div>

      {/* Header section with Subject Name & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <BookOpen className="size-7 text-indigo-400 shrink-0" />
              <span>{subject ? subject.name : "Loading Subject..."}</span>
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            {subject?.description || "Manage questions, multiple choice options, and difficulty levels for this subject."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={handleOpenImport}
            className="border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs h-9"
          >
            <Upload className="size-3.5 mr-1.5 text-indigo-400" />
            <span>Import CSV</span>
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/25 text-xs h-9"
          >
            <Plus className="size-3.5 mr-1.5" />
            <span>Add Question</span>
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive" className="border-rose-500/30 bg-rose-500/10 text-rose-300">
          <AlertCircle className="size-4 text-rose-400" />
          <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Card with filters & questions table */}
      <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6 border-b border-slate-800/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg font-semibold text-white">
                Questions Bank ({questions.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-0.5">
                Questions configured for dynamic examination batch generation.
              </CardDescription>
            </div>

            {/* Search and Difficulty Filter Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search questions or options..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-slate-950/60 border-slate-800 text-slate-200 text-xs placeholder:text-slate-500 focus-visible:ring-indigo-500/30"
                />
              </div>

              {/* Difficulty Filter */}
              <div className="w-full sm:w-44">
                <Select
                  value={selectedDifficulty}
                  onValueChange={(val) => setSelectedDifficulty(val as string)}
                >
                  <SelectTrigger className="h-9 w-full bg-slate-950/60 border-slate-800 text-slate-200 text-xs">
                    <SelectValue placeholder="All Difficulties" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-xs">
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
                <div key={i} className="flex flex-col gap-2 py-3 border-b border-slate-800/60">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-2/3 bg-slate-800" />
                    <Skeleton className="h-6 w-16 bg-slate-800/60 rounded-full" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <Skeleton className="h-4 bg-slate-800/40 rounded" />
                    <Skeleton className="h-4 bg-slate-800/40 rounded" />
                    <Skeleton className="h-4 bg-slate-800/40 rounded" />
                    <Skeleton className="h-4 bg-slate-800/40 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredQuestions.length === 0 ? (
            /* Empty State */
            <div className="py-16 px-4 text-center">
              <div className="size-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="size-7" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                {searchQuery || selectedDifficulty !== "all"
                  ? "No matching questions found"
                  : "No questions in this repository yet"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto mb-6">
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
                  className="border-slate-800 text-slate-300 hover:text-white text-xs"
                >
                  Reset Filters
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <Button
                    onClick={handleOpenAdd}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9"
                  >
                    <Plus className="size-3.5 mr-1.5" />
                    <span>Add Question</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleOpenImport}
                    className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs h-9"
                  >
                    <Upload className="size-3.5 mr-1.5 text-indigo-400" />
                    <span>Import CSV</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Questions Table */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 text-xs font-semibold py-3 px-4 w-12 text-center">
                      #
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold py-3 px-4 min-w-[280px]">
                      Question Text & Options
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold py-3 px-4 text-center w-28">
                      Correct Key
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold py-3 px-4 text-center w-28">
                      Difficulty
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold py-3 px-4 text-right w-20">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuestions.map((q, idx) => (
                    <TableRow
                      key={q.id}
                      className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Row index */}
                      <TableCell className="py-4 px-4 text-center text-xs text-slate-500 font-mono">
                        {idx + 1}
                      </TableCell>

                      {/* Question text and options */}
                      <TableCell className="py-4 px-4">
                        <div className="space-y-2.5">
                          <p className="text-sm font-medium text-slate-100 line-clamp-2 leading-snug">
                            {q.question_text}
                          </p>

                          {/* Options grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                            <div
                              className={`p-1.5 rounded-md border flex items-center gap-2 ${
                                q.correct_option === "A"
                                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                                  : "bg-slate-950/40 border-slate-800/70 text-slate-400"
                              }`}
                            >
                              <span
                                className={`size-5 rounded font-bold text-[10px] flex items-center justify-center shrink-0 ${
                                  q.correct_option === "A"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                A
                              </span>
                              <span className="truncate">{q.option_a}</span>
                            </div>

                            <div
                              className={`p-1.5 rounded-md border flex items-center gap-2 ${
                                q.correct_option === "B"
                                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                                  : "bg-slate-950/40 border-slate-800/70 text-slate-400"
                              }`}
                            >
                              <span
                                className={`size-5 rounded font-bold text-[10px] flex items-center justify-center shrink-0 ${
                                  q.correct_option === "B"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                B
                              </span>
                              <span className="truncate">{q.option_b}</span>
                            </div>

                            <div
                              className={`p-1.5 rounded-md border flex items-center gap-2 ${
                                q.correct_option === "C"
                                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                                  : "bg-slate-950/40 border-slate-800/70 text-slate-400"
                              }`}
                            >
                              <span
                                className={`size-5 rounded font-bold text-[10px] flex items-center justify-center shrink-0 ${
                                  q.correct_option === "C"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                C
                              </span>
                              <span className="truncate">{q.option_c}</span>
                            </div>

                            <div
                              className={`p-1.5 rounded-md border flex items-center gap-2 ${
                                q.correct_option === "D"
                                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                                  : "bg-slate-950/40 border-slate-800/70 text-slate-400"
                              }`}
                            >
                              <span
                                className={`size-5 rounded font-bold text-[10px] flex items-center justify-center shrink-0 ${
                                  q.correct_option === "D"
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-800 text-slate-400"
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
                          className="bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold text-xs px-2.5 py-0.5"
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
                                className="size-8 text-slate-400 hover:text-white hover:bg-slate-800"
                              >
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Question options</span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent
                            align="end"
                            className="w-40 bg-slate-900 border-slate-800 text-slate-200"
                          >
                            <DropdownMenuItem
                              className="cursor-pointer text-xs focus:bg-slate-800 focus:text-white"
                              onClick={() => handleOpenEdit(q)}
                            >
                              <Pencil className="size-3.5 mr-2 text-amber-400" />
                              <span>Edit Question</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-800" />
                            <DropdownMenuItem
                              className="cursor-pointer text-xs text-rose-400 focus:bg-rose-500/10 focus:text-rose-300"
                              onClick={() => handleOpenDelete(q)}
                            >
                              <Trash2 className="size-3.5 mr-2 text-rose-400" />
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
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateQuestion}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="size-5 text-indigo-400" />
                <span>Add Question to Bank</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Specify question content, 4 multiple choice choices, correct answer key, and difficulty.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Question Text */}
              <div className="space-y-1.5">
                <Label htmlFor="q-text" className="text-xs font-semibold text-slate-300">
                  Question Text <span className="text-rose-400">*</span>
                </Label>
                <Textarea
                  id="q-text"
                  placeholder="Enter the question prompt or problem statement..."
                  value={formData.question_text}
                  onChange={(e) =>
                    setFormData({ ...formData, question_text: e.target.value })
                  }
                  rows={3}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                  required
                  autoFocus
                />
              </div>

              {/* Options A & B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="opt-a" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="size-4 rounded bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                      A
                    </span>
                    <span>Option A</span>
                    <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="opt-a"
                    placeholder="Value for Option A"
                    value={formData.option_a}
                    onChange={(e) =>
                      setFormData({ ...formData, option_a: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="opt-b" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="size-4 rounded bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                      B
                    </span>
                    <span>Option B</span>
                    <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="opt-b"
                    placeholder="Value for Option B"
                    value={formData.option_b}
                    onChange={(e) =>
                      setFormData({ ...formData, option_b: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                    required
                  />
                </div>
              </div>

              {/* Options C & D */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="opt-c" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="size-4 rounded bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                      C
                    </span>
                    <span>Option C</span>
                    <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="opt-c"
                    placeholder="Value for Option C"
                    value={formData.option_c}
                    onChange={(e) =>
                      setFormData({ ...formData, option_c: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="opt-d" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="size-4 rounded bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                      D
                    </span>
                    <span>Option D</span>
                    <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="opt-d"
                    placeholder="Value for Option D"
                    value={formData.option_d}
                    onChange={(e) =>
                      setFormData({ ...formData, option_d: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                    required
                  />
                </div>
              </div>

              {/* Correct Option and Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="correct-opt" className="text-xs font-semibold text-slate-300">
                    Correct Answer Key <span className="text-rose-400">*</span>
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
                    <SelectTrigger id="correct-opt" className="h-9 w-full bg-slate-950 border-slate-800 text-slate-100 text-sm">
                      <SelectValue placeholder="Select correct option" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                      <SelectItem value="A">Option A</SelectItem>
                      <SelectItem value="B">Option B</SelectItem>
                      <SelectItem value="C">Option C</SelectItem>
                      <SelectItem value="D">Option D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="difficulty" className="text-xs font-semibold text-slate-300">
                    Difficulty Level <span className="text-rose-400">*</span>
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
                    <SelectTrigger id="difficulty" className="h-9 w-full bg-slate-950 border-slate-800 text-slate-100 text-sm">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="bg-slate-950/60 border-t border-slate-800/80 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                disabled={isSubmitting}
                className="border-slate-800 text-slate-300 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
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
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleUpdateQuestion}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Pencil className="size-5 text-amber-400" />
                <span>Edit Question</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Update prompt, options, answer key, or difficulty.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Question Text */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-q-text" className="text-xs font-semibold text-slate-300">
                  Question Text <span className="text-rose-400">*</span>
                </Label>
                <Textarea
                  id="edit-q-text"
                  value={formData.question_text}
                  onChange={(e) =>
                    setFormData({ ...formData, question_text: e.target.value })
                  }
                  rows={3}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                  required
                />
              </div>

              {/* Options A & B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-opt-a" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="size-4 rounded bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                      A
                    </span>
                    <span>Option A</span>
                    <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="edit-opt-a"
                    value={formData.option_a}
                    onChange={(e) =>
                      setFormData({ ...formData, option_a: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-opt-b" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="size-4 rounded bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                      B
                    </span>
                    <span>Option B</span>
                    <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="edit-opt-b"
                    value={formData.option_b}
                    onChange={(e) =>
                      setFormData({ ...formData, option_b: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                    required
                  />
                </div>
              </div>

              {/* Options C & D */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-opt-c" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="size-4 rounded bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                      C
                    </span>
                    <span>Option C</span>
                    <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="edit-opt-c"
                    value={formData.option_c}
                    onChange={(e) =>
                      setFormData({ ...formData, option_c: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-opt-d" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="size-4 rounded bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center font-bold">
                      D
                    </span>
                    <span>Option D</span>
                    <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="edit-opt-d"
                    value={formData.option_d}
                    onChange={(e) =>
                      setFormData({ ...formData, option_d: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm focus-visible:ring-indigo-500/30"
                    required
                  />
                </div>
              </div>

              {/* Correct Option and Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-correct-opt" className="text-xs font-semibold text-slate-300">
                    Correct Answer Key <span className="text-rose-400">*</span>
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
                    <SelectTrigger id="edit-correct-opt" className="h-9 w-full bg-slate-950 border-slate-800 text-slate-100 text-sm">
                      <SelectValue placeholder="Select correct option" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                      <SelectItem value="A">Option A</SelectItem>
                      <SelectItem value="B">Option B</SelectItem>
                      <SelectItem value="C">Option C</SelectItem>
                      <SelectItem value="D">Option D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-diff" className="text-xs font-semibold text-slate-300">
                    Difficulty Level <span className="text-rose-400">*</span>
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
                    <SelectTrigger id="edit-diff" className="h-9 w-full bg-slate-950 border-slate-800 text-slate-100 text-sm">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="bg-slate-950/60 border-t border-slate-800/80 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
                className="border-slate-800 text-slate-300 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
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
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <Trash2 className="size-5" />
              <span>Delete Question</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300">
              Are you sure you want to permanently remove this question from the bank?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium">
              &quot;{deletingQuestion?.question_text}&quot;
            </div>

            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg flex items-start gap-2">
              <AlertCircle className="size-4 text-rose-400 shrink-0 mt-0.5" />
              <span>This question will not be included in future exam batch generation.</span>
            </div>
          </div>

          <DialogFooter className="bg-slate-950/60 border-t border-slate-800/80 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isSubmitting}
              className="border-slate-800 text-slate-300 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDeleteQuestion}
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs"
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
        <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleImportCsv}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-indigo-400" />
                <span>Import Questions via CSV</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Bulk upload multiple choice questions for &quot;{subject?.name}&quot;.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Template Download Prompt */}
              <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/10 flex items-center justify-between gap-3">
                <div className="text-xs text-indigo-200">
                  <span className="font-semibold block text-indigo-100">Need a CSV template?</span>
                  Download the sample template with pre-configured headers and example rows.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSampleCsv}
                  className="shrink-0 h-8 text-xs border-indigo-500/40 text-indigo-300 hover:text-white hover:bg-indigo-600"
                >
                  <Download className="size-3 mr-1" />
                  <span>Sample CSV</span>
                </Button>
              </div>

              {/* Required Columns Guide */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-xs space-y-1.5 text-slate-400">
                <span className="font-semibold text-slate-200 block">Required CSV Column Headers:</span>
                <div className="flex flex-wrap gap-1 font-mono text-[11px] text-slate-300">
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">question_text</code>
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">option_a</code>
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">option_b</code>
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">option_c</code>
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">option_d</code>
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">correct_option</code>
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">difficulty</code>
                </div>
                <p className="text-[11px] text-slate-500 pt-1">
                  * <span className="text-slate-400">correct_option</span> must be A, B, C, or D.
                  * <span className="text-slate-400">difficulty</span> can be easy, medium, or hard.
                </p>
              </div>

              {/* File input */}
              <div className="space-y-1.5">
                <Label htmlFor="csv-file-input" className="text-xs font-semibold text-slate-300">
                  Select CSV File <span className="text-rose-400">*</span>
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
                  className="bg-slate-950 border-slate-800 text-slate-200 file:text-indigo-400 file:bg-slate-800 file:hover:bg-slate-750 file:border-0 file:rounded-md file:text-xs file:font-semibold text-xs cursor-pointer"
                />
              </div>

              {/* Import Results Summary if available */}
              {importSummary && (
                <div className="space-y-2 pt-1">
                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-950 text-xs space-y-1">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                      <CheckCircle2 className="size-4" />
                      <span>{importSummary.imported} Questions Imported Successfully</span>
                    </div>
                    {importSummary.skipped > 0 && (
                      <div className="flex items-center gap-2 text-amber-400 font-semibold pt-1">
                        <AlertCircle className="size-4" />
                        <span>{importSummary.skipped} Questions Skipped (Validation Errors)</span>
                      </div>
                    )}
                  </div>

                  {importSummary.errors.length > 0 && (
                    <div className="p-2.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-xs text-rose-300 max-h-36 overflow-y-auto space-y-1">
                      <div className="font-semibold text-rose-200">Error Details:</div>
                      {importSummary.errors.map((err, i) => (
                        <div key={i} className="text-[11px] text-rose-300/90 font-mono">
                          • {err}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="bg-slate-950/60 border-t border-slate-800/80 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsImportOpen(false)}
                disabled={isImporting}
                className="border-slate-800 text-slate-300 hover:text-white text-xs"
              >
                Close
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isImporting || !csvFile}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
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
