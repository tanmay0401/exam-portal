"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Clock,
  Award,
  Hash,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QuestionData {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  difficulty: "easy" | "medium" | "hard";
}

interface BatchQuestionItem {
  id: string;
  question_order: number;
  questions: QuestionData;
}

interface BatchData {
  id: string;
  batch_number: number;
  exam_id: string;
  created_at: string;
  exams?: {
    id: string;
    title: string;
    status: string;
    duration_minutes: number;
    marks_per_question: number;
    negative_marks: number;
    total_questions: number;
    subjects?: {
      name: string;
    };
  };
}

export default function BatchPreviewPage() {
  const params = useParams();
  const id = params.id as string;
  const batchId = params.batchId as string;

  const [batch, setBatch] = useState<BatchData | null>(null);
  const [questions, setQuestions] = useState<BatchQuestionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBatchPreview() {
      try {
        setLoading(true);
        const res = await fetch(`/api/exams/${id}/batches/${batchId}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to load batch preview");
        }
        const data = await res.json();
        setBatch(data.batch);
        setQuestions(data.questions || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error loading batch preview";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    if (id && batchId) {
      loadBatchPreview();
    }
  }, [id, batchId]);

  const getDifficultyBadge = (diff: "easy" | "medium" | "hard") => {
    switch (diff) {
      case "easy":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#34C759]/10 text-[#1E7E34] border border-[#34C759]/30">
            Easy
          </span>
        );
      case "medium":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FF9500]/10 text-[#B25E00] border border-[#FF9500]/30">
            Medium
          </span>
        );
      case "hard":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FF3B30]/10 text-[#D70015] border border-[#FF3B30]/30">
            Hard
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-[#6E6E73] space-y-2">
        <Loader2 className="size-6 animate-spin text-[#0071E3]" />
        <p className="text-[13px]">Generating test paper preview...</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="py-20 text-center space-y-3 max-w-md mx-auto">
        <AlertCircle className="size-10 text-[#FF3B30] mx-auto" />
        <h2 className="text-[17px] font-semibold text-[#1D1D1F]">Batch Not Found</h2>
        <p className="text-[13px] text-[#6E6E73]">
          The requested test paper batch could not be found for this examination.
        </p>
        <Button asChild size="sm" className="bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl">
          <Link href={`/admin/exams/${id}`}>Return to Exam</Link>
        </Button>
      </div>
    );
  }

  const examInfo = batch.exams;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#E8E8ED]/60 rounded-full h-8 px-3 text-[12px]"
        >
          <Link href={`/admin/exams/${id}`}>
            <ArrowLeft className="size-3.5 mr-1.5" />
            <span>Back to Exam Detail</span>
          </Link>
        </Button>

        <span className="text-[12px] text-[#6E6E73]">
          Admin Preview Mode • Answer Keys Revealed
        </span>
      </div>

      {/* Paper Header / Metadata Card */}
      <div className="bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
              Batch #{batch.batch_number} Paper
            </span>
            {examInfo?.subjects && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5EA]">
                {examInfo.subjects.name}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            {examInfo?.title || "Examination Paper Preview"}
          </h1>
          <p className="text-[13px] text-[#6E6E73] mt-0.5">
            Full examination question set as rendered to examinees assigned to this randomized batch.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-[12px]">
          <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA]">
            <span className="text-[#6E6E73] flex items-center gap-1.5">
              <Hash className="size-3.5 text-[#0071E3]" />
              <span>Questions</span>
            </span>
            <span className="text-xl font-semibold text-[#1D1D1F] font-mono mt-1 block">
              {questions.length}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA]">
            <span className="text-[#6E6E73] flex items-center gap-1.5">
              <Clock className="size-3.5 text-[#0071E3]" />
              <span>Duration</span>
            </span>
            <span className="text-xl font-semibold text-[#1D1D1F] font-mono mt-1 block">
              {examInfo?.duration_minutes ?? 60} mins
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA]">
            <span className="text-[#6E6E73] flex items-center gap-1.5">
              <Award className="size-3.5 text-[#0071E3]" />
              <span>Scoring</span>
            </span>
            <span className="text-xl font-semibold text-[#1D1D1F] font-mono mt-1 block">
              +{examInfo?.marks_per_question ?? 4} / -{examInfo?.negative_marks ?? 1}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA]">
            <span className="text-[#6E6E73] flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-[#0071E3]" />
              <span>Max Marks</span>
            </span>
            <span className="text-xl font-semibold text-[#1D1D1F] font-mono mt-1 block">
              {(examInfo?.marks_per_question ?? 4) * questions.length} pts
            </span>
          </div>
        </div>
      </div>

      {/* Question Paper List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-[12px] text-[#6E6E73] px-1">
          <span className="font-semibold text-[#1D1D1F]">
            Questions in this Batch ({questions.length})
          </span>
          <span className="flex items-center gap-1.5 text-[#1E7E34]">
            <CheckCircle2 className="size-3.5 text-[#34C759]" />
            <span>Green border indicates registered correct key</span>
          </span>
        </div>

        {questions.length === 0 ? (
          <div className="p-10 text-center rounded-2xl border border-[#D2D2D7] bg-white text-[#6E6E73] text-[13px]">
            No questions linked to this batch paper.
          </div>
        ) : (
          questions.map((item, index) => {
            const q = item.questions;
            if (!q) return null;

            const options: { key: "A" | "B" | "C" | "D"; text: string }[] = [
              { key: "A", text: q.option_a },
              { key: "B", text: q.option_b },
              { key: "C", text: q.option_c },
              { key: "D", text: q.option_d },
            ];

            return (
              <div
                key={item.id}
                className="bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="size-7 rounded-lg bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] flex items-center justify-center font-mono font-semibold text-[12px]">
                      Q{item.question_order || index + 1}
                    </span>
                    {getDifficultyBadge(q.difficulty)}
                  </div>
                </div>

                <div className="text-[15px] font-normal text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">
                  {q.question_text}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {options.map((opt) => {
                    const isCorrect = q.correct_option === opt.key;
                    return (
                      <div
                        key={opt.key}
                        className={`p-3.5 rounded-xl border text-[13px] flex items-center justify-between transition-colors ${
                          isCorrect
                            ? "bg-[#34C759]/10 border-[#34C759] text-[#1E7E34]"
                            : "bg-[#F5F5F7] border-[#E5E5EA] text-[#1D1D1F]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`size-6 rounded-md flex items-center justify-center font-mono font-semibold text-[12px] ${
                              isCorrect
                                ? "bg-[#34C759] text-white"
                                : "bg-white border border-[#D2D2D7] text-[#1D1D1F]"
                            }`}
                          >
                            {opt.key}
                          </span>
                          <span className="leading-snug">{opt.text}</span>
                        </div>

                        {isCorrect && (
                          <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-[#34C759]/20 text-[#1E7E34] shrink-0 ml-2">
                            Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Return button */}
      <div className="flex justify-center pt-4 pb-12">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] rounded-xl h-9 px-4 text-[13px]"
        >
          <Link href={`/admin/exams/${id}`}>
            <ArrowLeft className="size-3.5 mr-1.5" />
            <span>Return to Exam Overview</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
