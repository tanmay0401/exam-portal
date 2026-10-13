"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Loader2,
  FileText,
  Clock,
  Award,
  Hash,
  AlertCircle,
  Sparkles,
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
    } | null;
  } | null;
}

export default function BatchPreviewPage() {
  const routeParams = useParams();
  const id = (routeParams?.id as string) || "";
  const batchId = (routeParams?.batchId as string) || "";

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
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Easy
          </span>
        );
      case "medium":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Medium
          </span>
        );
      case "hard":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            Hard
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <Loader2 className="size-8 animate-spin text-indigo-500" />
        <p className="text-sm">Generating paper preview for Batch...</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle className="size-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">Batch Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested test paper batch could not be found for this examination.
        </p>
        <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <Link href={`/admin/exams/${id}`}>Return to Exam</Link>
        </Button>
      </div>
    );
  }

  const examInfo = batch.exams;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800"
        >
          <Link href={`/admin/exams/${id}`}>
            <ArrowLeft className="size-4 mr-1.5" />
            <span>Back to Exam Detail</span>
          </Link>
        </Button>

        <span className="text-xs text-slate-400">
          Generated Paper • Admin Answer Key Visible
        </span>
      </div>

      {/* Paper Header / Metadata Card */}
      <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur-xl">
        <CardHeader className="pb-4 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                  Batch #{batch.batch_number} Paper
                </Badge>
                {examInfo?.subjects && (
                  <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">
                    {examInfo.subjects.name}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-2xl font-black text-white tracking-tight">
                {examInfo?.title || "Examination Paper Preview"}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Full examination question set as rendered to examinees assigned to this randomized batch.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Hash className="size-3.5 text-indigo-400" />
                <span>Paper Length</span>
              </span>
              <span className="text-base font-bold text-white font-mono mt-1 block">
                {questions.length} Questions
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="size-3.5 text-indigo-400" />
                <span>Allotted Time</span>
              </span>
              <span className="text-base font-bold text-white font-mono mt-1 block">
                {examInfo?.duration_minutes ?? 60} mins
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Award className="size-3.5 text-indigo-400" />
                <span>Scoring Value</span>
              </span>
              <span className="text-base font-bold text-white font-mono mt-1 block">
                +{examInfo?.marks_per_question ?? 4} / -{examInfo?.negative_marks ?? 1}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-indigo-400" />
                <span>Maximum Marks</span>
              </span>
              <span className="text-base font-bold text-white font-mono mt-1 block">
                {(examInfo?.marks_per_question ?? 4) * questions.length} pts
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Paper List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
            Examination Questions ({questions.length})
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            <span>Green border indicates registered correct key</span>
          </span>
        </div>

        {questions.length === 0 ? (
          <div className="p-10 text-center rounded-xl border border-slate-800 bg-slate-900/30 text-slate-400 text-xs">
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
              <Card
                key={item.id}
                className="border-slate-800/80 bg-slate-900/50 backdrop-blur-md transition-all hover:border-slate-700"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="size-7 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-mono font-bold text-xs">
                        Q{item.question_order || index + 1}
                      </span>
                      {getDifficultyBadge(q.difficulty)}
                    </div>
                  </div>
                  <CardTitle className="text-base font-medium text-slate-100 mt-2 leading-relaxed whitespace-pre-wrap">
                    {q.question_text}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {options.map((opt) => {
                      const isCorrect = q.correct_option === opt.key;
                      return (
                        <div
                          key={opt.key}
                          className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                            isCorrect
                              ? "bg-emerald-500/10 border-emerald-500 text-emerald-200 shadow-sm shadow-emerald-500/10"
                              : "bg-slate-950/60 border-slate-800 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`size-6 rounded-md flex items-center justify-center font-mono font-bold text-xs ${
                                isCorrect
                                  ? "bg-emerald-500 text-slate-950"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {opt.key}
                            </span>
                            <span className="leading-snug">{opt.text}</span>
                          </div>

                          {isCorrect && (
                            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0 ml-2">
                              Correct Key
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Bottom Back Button */}
      <div className="flex justify-center pt-4 pb-12">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300"
        >
          <Link href={`/admin/exams/${id}`}>
            <ArrowLeft className="size-4 mr-1.5" />
            <span>Return to Exam Overview</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
