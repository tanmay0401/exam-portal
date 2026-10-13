"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Layers,
  Sparkles,
  Shuffle,
  Eye,
  Copy,
  Check,
  Loader2,
  Lock,
  Unlock,
  AlertCircle,
  ExternalLink,
  Award,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  Share2,
  XCircle,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface BatchItem {
  id: string;
  batch_number: number;
  created_at: string;
  exam_batch_questions?: { count: number }[];
}

interface ExamDetail {
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
  selected_batch_id: string | null;
  exam_link_token: string | null;
  published_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  subjects?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  exam_batches?: BatchItem[];
}

export default function ExamDetailPage() {
  const routeParams = useParams();
  const id = (routeParams?.id as string) || "";
  const router = useRouter();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [closing, setClosing] = useState(false);

  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Confirmation dialogs
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  const fetchExamDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/exams/${id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to load exam details");
      }
      const data = await res.json();
      setExam(data.exam);
      if (data.exam?.selected_batch_id) {
        setSelectedBatchId(data.exam.selected_batch_id);
      } else if (data.exam?.exam_batches && data.exam.exam_batches.length > 0) {
        setSelectedBatchId(data.exam.exam_batches[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Load failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchExamDetail();
    }
  }, [id]);

  const handleGenerateBatches = async () => {
    setGenerating(true);
    setShowRegenerateDialog(false);
    try {
      const res = await fetch(`/api/exams/${id}/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate batches");
      }
      toast.success(data.message || "Batches generated successfully!");
      await fetchExamDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handlePublishExam = async () => {
    if (!selectedBatchId) {
      toast.error("Please select a batch to publish.");
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch(`/api/exams/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: selectedBatchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to publish exam");
      }
      toast.success("Exam published successfully! Link is now active.");
      await fetchExamDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Publishing failed";
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  const handleCloseExam = async () => {
    setClosing(true);
    setShowCloseDialog(false);
    try {
      const res = await fetch(`/api/exams/${id}/close`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to close exam");
      }
      toast.success("Exam closed. Students can no longer access this session.");
      await fetchExamDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Closing failed";
      toast.error(msg);
    } finally {
      setClosing(false);
    }
  };

  const getShareableUrl = () => {
    if (!exam?.exam_link_token) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/exam/${exam.exam_link_token}`;
  };

  const copyToClipboard = async (text: string, isLink: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isLink) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      }
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <Loader2 className="size-8 animate-spin text-indigo-500" />
        <p className="text-sm">Loading examination details...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle className="size-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">Exam Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested examination could not be located or you do not have permission to view it.
        </p>
        <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <Link href="/admin/exams">Return to Exams List</Link>
        </Button>
      </div>
    );
  }

  const batches = exam.exam_batches || [];
  const hasBatches = batches.length > 0;
  const isDraft = exam.status === "draft";
  const isPublished = exam.status === "published";
  const isClosed = exam.status === "closed";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800"
          >
            <Link href="/admin/exams">
              <ArrowLeft className="size-4 mr-1.5" />
              <span>Back to Exams</span>
            </Link>
          </Button>
        </div>

        {/* Action Buttons Header */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isDraft && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (hasBatches) {
                    setShowRegenerateDialog(true);
                  } else {
                    handleGenerateBatches();
                  }
                }}
                disabled={generating || publishing}
                className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
              >
                {generating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Generating Batches...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Shuffle className="size-3.5" />
                    <span>{hasBatches ? "Regenerate Batches" : "Generate Batches"}</span>
                  </span>
                )}
              </Button>

              <Button
                size="sm"
                onClick={handlePublishExam}
                disabled={!hasBatches || !selectedBatchId || publishing || generating}
                className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25"
              >
                {publishing ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Unlock className="size-3.5" />
                    <span>Publish Exam</span>
                  </span>
                )}
              </Button>
            </>
          )}

          {isPublished && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowCloseDialog(true)}
              disabled={closing}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {closing ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Closing Exam...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Lock className="size-3.5" />
                  <span>Close Exam</span>
                </span>
              )}
            </Button>
          )}

          {isClosed && (
            <span className="px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-1.5">
              <Lock className="size-3.5" />
              <span>Assessment Closed</span>
            </span>
          )}
        </div>
      </div>

      {/* Prominent Shareable Link Banner (If Published) */}
      {isPublished && exam.exam_link_token && (
        <Card className="border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 to-slate-900/60 backdrop-blur-xl shadow-xl shadow-emerald-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs tracking-wider uppercase">
                <Share2 className="size-4 animate-pulse" />
                <span>Active Examination Link</span>
              </div>
              <span className="text-[11px] text-emerald-300 font-mono">
                Batch #{batches.find((b) => b.id === exam.selected_batch_id)?.batch_number || "Selected"}
              </span>
            </div>
            <CardTitle className="text-lg text-white">
              Student Direct Examination Link
            </CardTitle>
            <CardDescription className="text-xs text-slate-300">
              Distribute this link to authorized candidates. The token unlocks the selected randomized question batch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <div className="flex-1 bg-slate-950/80 border border-emerald-500/30 rounded-lg px-3 py-2 text-xs font-mono text-emerald-200 select-all overflow-x-auto whitespace-nowrap flex items-center">
                {getShareableUrl()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(getShareableUrl(), true)}
                className="border-emerald-500/40 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 shrink-0"
              >
                {copiedLink ? (
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <Check className="size-4 text-emerald-400" />
                    <span>Copied!</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Copy className="size-4" />
                    <span>Copy Link</span>
                  </span>
                )}
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 shrink-0"
              >
                <Link href={`/exam/${exam.exam_link_token}`} target="_blank">
                  <ExternalLink className="size-4 mr-1.5" />
                  <span>Open Exam</span>
                </Link>
              </Button>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
              <span>
                Token: <strong className="text-slate-200 font-mono">{exam.exam_link_token}</strong>
              </span>
              <span>•</span>
              <span>
                Published: {exam.published_at ? new Date(exam.published_at).toLocaleString() : "Just now"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Exam Details Configuration Card */}
      <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
        <CardHeader className="pb-4 border-b border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {exam.status === "draft" && (
                  <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">
                    Draft
                  </Badge>
                )}
                {exam.status === "published" && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    Published
                  </Badge>
                )}
                {exam.status === "closed" && (
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/30">
                    Closed
                  </Badge>
                )}

                {exam.is_dry_run && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                    <Sparkles className="size-3 mr-1" />
                    Dry Run Mode
                  </Badge>
                )}
              </div>
              <CardTitle className="text-2xl text-white font-extrabold tracking-tight">
                {exam.title}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Subject: <span className="text-slate-200 font-medium">{exam.subjects?.name || "Unassigned"}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Hash className="size-3.5 text-indigo-400" />
                <span>Questions</span>
              </div>
              <div className="text-xl font-bold text-white mt-1 font-mono">
                {exam.total_questions}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                in each batch paper
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Clock className="size-3.5 text-indigo-400" />
                <span>Duration</span>
              </div>
              <div className="text-xl font-bold text-white mt-1 font-mono">
                {exam.duration_minutes} <span className="text-xs font-normal text-slate-400">mins</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                timed countdown
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Award className="size-3.5 text-indigo-400" />
                <span>Marking Scheme</span>
              </div>
              <div className="text-xl font-bold text-white mt-1 font-mono">
                +{exam.marks_per_question} / -{exam.negative_marks}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Max Score: {exam.total_questions * exam.marks_per_question} pts
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Layers className="size-3.5 text-indigo-400" />
                <span>Configured Batches</span>
              </div>
              <div className="text-xl font-bold text-white mt-1 font-mono">
                {exam.batch_count}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {exam.allow_question_reuse ? "Reuse Allowed" : "Disjoint Sets"}
              </div>
            </div>
          </div>

          {(exam.starts_at || exam.ends_at) && (
            <div className="mt-4 p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-indigo-400" />
                <span>
                  Start:{" "}
                  <strong className="text-slate-200">
                    {exam.starts_at ? new Date(exam.starts_at).toLocaleString() : "Immediate"}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-indigo-400" />
                <span>
                  End:{" "}
                  <strong className="text-slate-200">
                    {exam.ends_at ? new Date(exam.ends_at).toLocaleString() : "Open Ended"}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batches Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="size-5 text-indigo-400" />
              <span>Randomized Examination Batches</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select one generated batch as the active paper to publish for test examinees.
            </p>
          </div>

          {isDraft && hasBatches && (
            <div className="text-xs text-slate-400">
              {selectedBatchId ? (
                <span className="text-indigo-400 font-medium">Batch selected for publishing</span>
              ) : (
                <span className="text-amber-400">Select a batch to enable publishing</span>
              )}
            </div>
          )}
        </div>

        {!hasBatches ? (
          <Card className="border-dashed border-slate-800 bg-slate-900/30">
            <CardContent className="py-14 text-center max-w-md mx-auto space-y-4">
              <div className="size-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                <Shuffle className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">No Batches Generated Yet</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Before candidates can take this examination, generate randomized multi-batch test papers from the subject question bank.
                </p>
              </div>
              <Button
                onClick={handleGenerateBatches}
                disabled={generating}
                className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25"
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Generating Batches...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Shuffle className="size-4" />
                    <span>Generate {exam.batch_count} Batches Now</span>
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map((batch) => {
              const isSelected = selectedBatchId === batch.id;
              const isCurrentlyPublishedBatch = exam.selected_batch_id === batch.id;
              const questionCount =
                batch.exam_batch_questions?.[0]?.count ?? exam.total_questions;

              return (
                <div
                  key={batch.id}
                  onClick={() => {
                    if (isDraft) {
                      setSelectedBatchId(batch.id);
                    }
                  }}
                  className={`relative rounded-xl border p-5 backdrop-blur-md transition-all flex flex-col justify-between ${
                    isDraft ? "cursor-pointer" : ""
                  } ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                      : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {isDraft && (
                          <input
                            type="radio"
                            name="selectedBatch"
                            checked={isSelected}
                            onChange={() => setSelectedBatchId(batch.id)}
                            className="size-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                          />
                        )}
                        <span className="text-base font-bold text-white tracking-tight">
                          Batch #{batch.batch_number}
                        </span>
                      </div>

                      {isCurrentlyPublishedBatch && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Live Active
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-xs text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Questions Count:</span>
                        <span className="text-slate-200 font-mono font-medium">
                          {questionCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Generated:</span>
                        <span className="text-slate-200">
                          {new Date(batch.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 h-8 px-2.5"
                    >
                      <Link href={`/admin/exams/${exam.id}/batches/${batch.id}`}>
                        <Eye className="size-3.5 mr-1.5" />
                        <span>Preview Paper</span>
                      </Link>
                    </Button>

                    {isDraft && isSelected && (
                      <span className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1">
                        <Check className="size-3" />
                        <span>Ready</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Batch Regeneration */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400 text-lg">
              <Shuffle className="size-5" />
              <span>Regenerate Batches?</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Existing batches and their randomized question configurations will be replaced with freshly randomized questions from the subject pool.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegenerateDialog(false)}
              className="border-slate-800 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleGenerateBatches}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Confirm Regeneration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Closing Exam */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-400 text-lg">
              <Lock className="size-5" />
              <span>Close Examination?</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Closing this examination will deactivate student candidate access. No new assessment attempts can be started with the exam token.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCloseDialog(false)}
              className="border-slate-800 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCloseExam}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              Confirm & Close Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
