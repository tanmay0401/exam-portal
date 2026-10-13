"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Layers,
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
  Share2,
  Hash,
  BarChart3,
} from "lucide-react";
import { getAppBaseUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  duration_minutes: number;
  batch_count: number;
  allow_question_reuse: boolean;
  status: "draft" | "published" | "closed";
  exam_link_token: string | null;
  selected_batch_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_dry_run: boolean;
  published_at: string | null;
  created_at: string;
  subjects?: {
    name: string;
    description: string | null;
  } | null;
}

export default function ExamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [closing, setClosing] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  const fetchExamDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/exams/${examId}`);
      if (!res.ok) {
        throw new Error("Failed to load examination configuration");
      }
      const data = await res.json();
      setExam(data.exam);
      const batchList: BatchItem[] = Array.isArray(data.batches)
        ? data.batches
        : (data.exam?.exam_batches || []);
      setBatches(batchList);

      if (data.exam?.selected_batch_id) {
        setSelectedBatchId(data.exam.selected_batch_id);
      } else if (batchList && batchList.length > 0) {
        setSelectedBatchId((prev) => (prev && batchList.some((b) => b.id === prev) ? prev : batchList[0].id));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading exam";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (examId) {
      fetchExamDetails();
    }
  }, [examId]);

  const handleGenerateBatches = async () => {
    setGenerating(true);
    setShowRegenerateDialog(false);
    try {
      const res = await fetch(`/api/exams/${examId}/generate`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate batches");
      }

      if (Array.isArray(data.batches) && data.batches.length > 0) {
        setBatches(data.batches);
        setSelectedBatchId(data.batches[0].id);
      }

      toast.success(`Successfully generated ${data.batches?.length || 0} batches.`);
      await fetchExamDetails();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Batch generation failed";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handlePublishExam = async () => {
    if (!selectedBatchId) {
      toast.error("Please select a batch before publishing this examination.");
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch(`/api/exams/${examId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_id: selectedBatchId,
          selected_batch_id: selectedBatchId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to publish exam");
      }

      toast.success("Exam published! Direct access link is now active.");
      await fetchExamDetails();
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
      const res = await fetch(`/api/exams/${examId}/close`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to close exam");
      }

      toast.success("Exam closed. Candidate test link deactivated.");
      await fetchExamDetails();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Closing failed";
      toast.error(msg);
    } finally {
      setClosing(false);
    }
  };

  const getShareableUrl = () => {
    if (!exam?.exam_link_token) return "";
    const base = getAppBaseUrl();
    return `${base}/exam/${exam.exam_link_token}`;
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    toast.success("Exam link copied to clipboard.");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading && !exam) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-[#6E6E73] space-y-2">
        <Loader2 className="size-6 animate-spin text-[#0071E3]" />
        <p className="text-[13px]">Loading examination details...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3">
        <AlertCircle className="size-10 text-[#FF3B30] mx-auto" />
        <h2 className="text-[17px] font-semibold text-[#1D1D1F]">Examination Not Found</h2>
        <p className="text-[13px] text-[#6E6E73]">
          The examination ID does not exist or has been deleted.
        </p>
        <Button asChild size="sm" className="bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl">
          <Link href="/admin/exams">Return to Examinations</Link>
        </Button>
      </div>
    );
  }

  const hasBatches = batches.length > 0;
  const isDraft = exam.status === "draft";
  const isPublished = exam.status === "published";
  const isClosed = exam.status === "closed";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#E8E8ED]/60 rounded-full h-8 px-3 text-[12px] mb-2"
          >
            <Link href="/admin/exams">
              <ArrowLeft className="size-3.5 mr-1.5" />
              <span>Back to Examinations</span>
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
            {exam.title}
          </h1>
          <p className="text-[13px] text-[#6E6E73] mt-0.5">
            Subject: {exam.subjects?.name || "Unassigned"} • Created: {new Date(exam.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Action Buttons Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-[13px] h-9 rounded-xl shadow-xs"
          >
            <Link href={`/admin/exams/${exam.id}/results`}>
              <BarChart3 className="size-3.5 mr-1.5 text-[#1E7E34]" />
              <span>Candidate Results</span>
            </Link>
          </Button>

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
                className="border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-[13px] h-9 rounded-xl shadow-xs"
              >
                {generating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin text-[#0071E3]" />
                    <span>Generating...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Shuffle className="size-3.5 text-[#0071E3]" />
                    <span>{hasBatches ? "Regenerate Batches" : "Generate Batches"}</span>
                  </span>
                )}
              </Button>

              <Button
                size="sm"
                onClick={handlePublishExam}
                disabled={!hasBatches || !selectedBatchId || publishing || generating}
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium h-9 px-4 rounded-xl shadow-xs"
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
              variant="outline"
              size="sm"
              onClick={() => setShowCloseDialog(true)}
              disabled={closing}
              className="border-[#FF3B30]/30 text-[#D70015] hover:bg-[#FF3B30]/10 text-[13px] h-9 rounded-xl"
            >
              {closing ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Closing...</span>
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
            <span className="px-3 py-1 rounded-full bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#D70015] text-[12px] font-medium flex items-center gap-1.5">
              <Lock className="size-3.5" />
              <span>Assessment Closed</span>
            </span>
          )}
        </div>
      </div>

      {/* Shareable Link Banner (If Published) */}
      {isPublished && exam.exam_link_token && (
        <div className="bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#1E7E34] font-semibold text-[13px]">
              <Share2 className="size-4" />
              <span>Active Examination Link</span>
            </div>
            <span className="text-[12px] text-[#6E6E73] font-mono">
              Batch #{batches.find((b) => b.id === exam.selected_batch_id)?.batch_number || "Selected"}
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-[15px] font-semibold text-[#1D1D1F]">
              Student Direct Examination Link
            </h3>
            <p className="text-[12px] text-[#6E6E73]">
              Distribute this link to authorized candidates. The token unlocks the selected randomized question batch.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
            <div className="flex-1 bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl px-3 py-2 text-[12px] font-mono text-[#1D1D1F] select-all overflow-x-auto whitespace-nowrap flex items-center">
              {getShareableUrl()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(getShareableUrl())}
              className="border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-[12px] h-9 rounded-xl shrink-0"
            >
              {copiedLink ? (
                <span className="flex items-center gap-1.5 text-[#1E7E34]">
                  <Check className="size-3.5" />
                  <span>Copied!</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Copy className="size-3.5 text-[#6E6E73]" />
                  <span>Copy Link</span>
                </span>
              )}
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-[12px] h-9 rounded-xl shrink-0"
            >
              <Link href={`/exam/${exam.exam_link_token}`} target="_blank">
                <ExternalLink className="size-3.5 mr-1.5" />
                <span>Open Exam</span>
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Main Exam Configuration Metrics Card */}
      <div className="bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[#1D1D1F]">
            Examination Structure
          </h2>
          <div className="flex items-center gap-2">
            {exam.status === "draft" && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E8E8ED] text-[#6E6E73] border border-[#D2D2D7]">
                Draft
              </span>
            )}
            {exam.status === "published" && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#34C759]/10 text-[#1E7E34] border border-[#34C759]/30">
                Published
              </span>
            )}
            {exam.status === "closed" && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FF3B30]/10 text-[#D70015] border border-[#FF3B30]/30">
                Closed
              </span>
            )}
            {exam.is_dry_run && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FF9500]/10 text-[#B25E00] border border-[#FF9500]/30">
                Dry Run Mode
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA]">
            <div className="text-[11px] font-medium text-[#6E6E73] flex items-center gap-1.5">
              <Hash className="size-3.5 text-[#0071E3]" />
              <span>Questions</span>
            </div>
            <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 font-mono">
              {exam.total_questions}
            </div>
            <div className="text-[11px] text-[#6E6E73] mt-0.5">
              per paper batch
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA]">
            <div className="text-[11px] font-medium text-[#6E6E73] flex items-center gap-1.5">
              <Clock className="size-3.5 text-[#0071E3]" />
              <span>Duration</span>
            </div>
            <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 font-mono">
              {exam.duration_minutes} <span className="text-[12px] font-normal text-[#6E6E73]">mins</span>
            </div>
            <div className="text-[11px] text-[#6E6E73] mt-0.5">
              countdown limit
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA]">
            <div className="text-[11px] font-medium text-[#6E6E73] flex items-center gap-1.5">
              <Award className="size-3.5 text-[#0071E3]" />
              <span>Scoring Rules</span>
            </div>
            <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 font-mono">
              +{exam.marks_per_question} / -{exam.negative_marks}
            </div>
            <div className="text-[11px] text-[#6E6E73] mt-0.5">
              Max: {exam.total_questions * exam.marks_per_question} pts
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA]">
            <div className="text-[11px] font-medium text-[#6E6E73] flex items-center gap-1.5">
              <Layers className="size-3.5 text-[#0071E3]" />
              <span>Batches Pool</span>
            </div>
            <div className="text-2xl font-semibold text-[#1D1D1F] mt-1 font-mono">
              {exam.batch_count}
            </div>
            <div className="text-[11px] text-[#6E6E73] mt-0.5">
              {exam.allow_question_reuse ? "Overlap allowed" : "Disjoint sets"}
            </div>
          </div>
        </div>

        {(exam.starts_at || exam.ends_at) && (
          <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] text-[12px] text-[#6E6E73] flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-[#0071E3]" />
              <span>
                Start: <strong className="text-[#1D1D1F]">{exam.starts_at ? new Date(exam.starts_at).toLocaleString() : "Immediate"}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-[#0071E3]" />
              <span>
                End: <strong className="text-[#1D1D1F]">{exam.ends_at ? new Date(exam.ends_at).toLocaleString() : "Open Ended"}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Batches Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1D1D1F] tracking-tight flex items-center gap-2">
              <Layers className="size-4.5 text-[#0071E3]" />
              <span>Randomized Examination Batches</span>
            </h2>
            <p className="text-[12px] text-[#6E6E73]">
              Select which randomized batch will be assigned to candidates when published.
            </p>
          </div>

          {isDraft && hasBatches && (
            <div className="text-[12px] text-[#6E6E73]">
              {selectedBatchId ? (
                <span className="text-[#0071E3] font-medium">Batch selected for publishing</span>
              ) : (
                <span className="text-[#B25E00]">Select a batch to enable publishing</span>
              )}
            </div>
          )}
        </div>

        {!hasBatches ? (
          <div className="bg-white border border-dashed border-[#D2D2D7] rounded-2xl p-12 text-center max-w-md mx-auto space-y-3">
            <div className="size-11 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] text-[#0071E3] flex items-center justify-center mx-auto">
              <Shuffle className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[15px] font-semibold text-[#1D1D1F]">No Batches Generated Yet</h3>
              <p className="text-[12px] text-[#6E6E73] leading-relaxed">
                Generate randomized multi-batch test papers from the subject question bank before publishing.
              </p>
            </div>
            <Button
              onClick={handleGenerateBatches}
              disabled={generating}
              className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] rounded-xl font-medium mt-1"
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
          </div>
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
                  className={`relative rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                    isDraft ? "cursor-pointer" : ""
                  } ${
                    isSelected
                      ? "border-[#0071E3] bg-[#0071E3]/5 shadow-xs"
                      : "border-[#D2D2D7] bg-white hover:border-[#B0B0B8]"
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
                            className="size-4 text-[#0071E3] focus:ring-[#0071E3] cursor-pointer accent-[#0071E3]"
                          />
                        )}
                        <span className="text-[15px] font-semibold text-[#1D1D1F]">
                          Batch #{batch.batch_number}
                        </span>
                      </div>

                      {isCurrentlyPublishedBatch && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#34C759]/10 text-[#1E7E34] border border-[#34C759]/30">
                          Live Active
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-[12px] text-[#6E6E73]">
                      <div className="flex items-center justify-between">
                        <span>Questions Count:</span>
                        <span className="text-[#1D1D1F] font-mono font-medium">
                          {questionCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Generated:</span>
                        <span className="text-[#1D1D1F]">
                          {new Date(batch.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#E5E5EA] flex items-center justify-between">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="text-[12px] text-[#0071E3] hover:bg-[#0071E3]/10 h-7 px-2.5 rounded-lg"
                    >
                      <Link href={`/admin/exams/${exam.id}/batches/${batch.id}`}>
                        <Eye className="size-3.5 mr-1" />
                        <span>Preview Paper</span>
                      </Link>
                    </Button>

                    {isDraft && isSelected && (
                      <span className="text-[11px] font-medium text-[#0071E3] flex items-center gap-1">
                        <Check className="size-3" />
                        <span>Selected</span>
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
        <DialogContent className="border-[#D2D2D7] bg-white text-[#1D1D1F] sm:max-w-md rounded-2xl p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#B25E00] text-[16px]">
              <Shuffle className="size-5" />
              <span>Regenerate Batches?</span>
            </DialogTitle>
            <DialogDescription className="text-[#6E6E73] text-[13px] pt-1 leading-relaxed">
              Existing batch papers will be replaced with freshly randomized questions from the subject pool.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegenerateDialog(false)}
              className="border-[#D2D2D7] bg-white text-[#1D1D1F] rounded-xl text-[12px]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleGenerateBatches}
              className="bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-[12px]"
            >
              Confirm Regeneration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Closing Exam */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="border-[#D2D2D7] bg-white text-[#1D1D1F] sm:max-w-md rounded-2xl p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#D70015] text-[16px]">
              <Lock className="size-5" />
              <span>Close Examination?</span>
            </DialogTitle>
            <DialogDescription className="text-[#6E6E73] text-[13px] pt-1 leading-relaxed">
              Closing this examination will deactivate student candidate access. No new assessment attempts can be started with the exam token.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCloseDialog(false)}
              className="border-[#D2D2D7] bg-white text-[#1D1D1F] rounded-xl text-[12px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCloseExam}
              className="bg-[#FF3B30] hover:bg-[#E03126] text-white rounded-xl text-[12px]"
            >
              Confirm & Close Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
