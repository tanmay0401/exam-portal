"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  Loader2,
  BookOpen,
  Settings2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface SubjectOption {
  id: string;
  name: string;
  description: string | null;
}

export default function CreateExamPage() {
  const router = useRouter();

  // Form states
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [totalQuestions, setTotalQuestions] = useState<number | string>(20);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number | string>(4);
  const [negativeMarks, setNegativeMarks] = useState<number | string>(1);
  const [durationMinutes, setDurationMinutes] = useState<number | string>(60);
  const [batchCount, setBatchCount] = useState<number | string>(3);
  const [allowQuestionReuse, setAllowQuestionReuse] = useState(true);
  const [isDryRun, setIsDryRun] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // Subjects data
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadSubjects() {
      try {
        setLoadingSubjects(true);
        const res = await fetch("/api/subjects");
        if (res.ok) {
          const data = await res.json();
          setSubjects(data.subjects || []);
          if (data.subjects && data.subjects.length > 0) {
            setSubjectId(data.subjects[0].id);
          }
        } else {
          toast.error("Failed to load subjects");
        }
      } catch (err: unknown) {
        console.error("Error loading subjects:", err);
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadSubjects();
  }, []);

  const parsedTotalQuestions = Number(totalQuestions) || 0;
  const parsedMarksPerQuestion = Number(marksPerQuestion) || 0;
  const computedMaxMarks = parsedTotalQuestions * parsedMarksPerQuestion;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter an exam title.");
      return;
    }

    if (!subjectId) {
      toast.error("Please select a subject.");
      return;
    }

    if (parsedTotalQuestions <= 0) {
      toast.error("Total questions must be greater than 0.");
      return;
    }

    if (Number(durationMinutes) <= 0) {
      toast.error("Duration must be greater than 0 minutes.");
      return;
    }

    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      toast.error("End time must be later than start time.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        subject_id: subjectId,
        total_questions: parsedTotalQuestions,
        marks_per_question: parsedMarksPerQuestion,
        negative_marks: Number(negativeMarks) || 0,
        duration_minutes: Number(durationMinutes),
        batch_count: Number(batchCount) || 1,
        allow_question_reuse: allowQuestionReuse,
        is_dry_run: isDryRun,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
      };

      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create exam");
      }

      toast.success("Exam created successfully!");
      router.push(`/admin/exams/${data.exam.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Creation failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#E8E8ED]/60 rounded-full h-8 px-3 text-[12px]"
        >
          <Link href="/admin/exams">
            <ArrowLeft className="size-3.5 mr-1.5" />
            <span>Back to Examinations</span>
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
          Create Examination
        </h1>
        <p className="text-[13px] text-[#6E6E73] mt-0.5">
          Define exam identity, scoring formulas, multi-batch parameters, and optional availability schedules.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Info */}
        <div className="bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#0071E3] font-semibold text-[13px]">
            <BookOpen className="size-4" />
            <span>Basic Information</span>
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-[12px] font-medium text-[#1D1D1F]">
                Exam Title <span className="text-[#FF3B30]">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Computer Science Mid-Term Assessment 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] placeholder:text-[#86868B] focus-visible:bg-white focus-visible:border-[#0071E3] h-10 text-[13px] rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-[12px] font-medium text-[#1D1D1F]">
                Subject Bank <span className="text-[#FF3B30]">*</span>
              </Label>
              {loadingSubjects ? (
                <div className="h-10 w-full bg-[#F5F5F7] rounded-xl border border-[#D2D2D7] flex items-center px-3 text-[12px] text-[#6E6E73] gap-2">
                  <Loader2 className="size-3.5 animate-spin text-[#0071E3]" />
                  <span>Loading subjects...</span>
                </div>
              ) : subjects.length === 0 ? (
                <div className="p-3 bg-[#FF9500]/10 border border-[#FF9500]/30 rounded-xl text-[12px] text-[#B25E00] flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>
                    No subjects found. Please create a subject in the question bank first.
                  </span>
                </div>
              ) : (
                <Select
                  value={subjectId}
                  onValueChange={(val) => setSubjectId(val as string)}
                >
                  <SelectTrigger className="w-full bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] h-10 text-[13px] rounded-xl focus:bg-white focus:border-[#0071E3]">
                    <SelectValue placeholder="Select a subject..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#D2D2D7] text-[#1D1D1F] rounded-xl shadow-lg">
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-[13px] hover:bg-[#F5F5F7] rounded-lg">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Questions & Scoring Rules */}
        <div className="bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#0071E3] font-semibold text-[13px]">
            <Settings2 className="size-4" />
            <span>Questions & Scoring Scheme</span>
          </div>

          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="totalQuestions" className="text-[12px] font-medium text-[#1D1D1F]">
                  Total Questions <span className="text-[#FF3B30]">*</span>
                </Label>
                <Input
                  id="totalQuestions"
                  type="number"
                  min={1}
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(e.target.value)}
                  required
                  className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] h-10 text-[13px] font-mono rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
                />
                <p className="text-[11px] text-[#6E6E73]">
                  Number of questions drawn into each candidate&apos;s paper.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="duration" className="text-[12px] font-medium text-[#1D1D1F]">
                  Duration (Minutes) <span className="text-[#FF3B30]">*</span>
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  required
                  className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] h-10 text-[13px] font-mono rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
                />
                <p className="text-[11px] text-[#6E6E73]">
                  Countdown limit before auto-submission triggers.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="marksPerQuestion" className="text-[12px] font-medium text-[#1D1D1F]">
                  Marks per Correct Question
                </Label>
                <Input
                  id="marksPerQuestion"
                  type="number"
                  step="0.5"
                  min={0.5}
                  value={marksPerQuestion}
                  onChange={(e) => setMarksPerQuestion(e.target.value)}
                  className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] h-10 text-[13px] font-mono rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
                />
                <p className="text-[11px] text-[#6E6E73]">Default: +4 marks per correct response.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="negativeMarks" className="text-[12px] font-medium text-[#1D1D1F]">
                  Negative Marks (Penalty)
                </Label>
                <Input
                  id="negativeMarks"
                  type="number"
                  step="0.25"
                  min={0}
                  value={negativeMarks}
                  onChange={(e) => setNegativeMarks(e.target.value)}
                  className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] h-10 text-[13px] font-mono rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
                />
                <p className="text-[11px] text-[#6E6E73]">
                  Deducted marks for incorrect choices (default: -1 penalty).
                </p>
              </div>
            </div>

            {/* Computed Max Marks Banner */}
            <div className="rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-white border border-[#D2D2D7] text-[#0071E3] flex items-center justify-center">
                  <Calculator className="size-4.5" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#1D1D1F]">Maximum Achievable Score</div>
                  <div className="text-[11px] text-[#6E6E73]">
                    {parsedTotalQuestions} questions × {parsedMarksPerQuestion} marks
                  </div>
                </div>
              </div>
              <div className="text-2xl font-semibold text-[#1D1D1F] font-mono">
                {computedMaxMarks} <span className="text-[12px] font-normal text-[#6E6E73]">pts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Multi-Batch & Security Options */}
        <div className="bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#0071E3] font-semibold text-[13px]">
            <Layers className="size-4" />
            <span>Multi-Batch Generation & Test Mode</span>
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="batchCount" className="text-[12px] font-medium text-[#1D1D1F]">
                Number of Batches to Generate (Default: 3)
              </Label>
              <Input
                id="batchCount"
                type="number"
                min={1}
                max={20}
                value={batchCount}
                onChange={(e) => setBatchCount(e.target.value)}
                className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] h-10 text-[13px] font-mono max-w-xs rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
              />
              <p className="text-[11px] text-[#6E6E73]">
                Independent test paper variations generated algorithmically.
              </p>
            </div>

            <Separator className="bg-[#E5E5EA]" />

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-[13px] font-medium text-[#1D1D1F]">
                  Allow Question Overlap Between Batches
                </Label>
                <p className="text-[11px] text-[#6E6E73]">
                  When disabled, questions will not be reused across batches if the question pool has sufficient size.
                </p>
              </div>
              <Switch
                checked={allowQuestionReuse}
                onCheckedChange={setAllowQuestionReuse}
              />
            </div>

            <Separator className="bg-[#E5E5EA]" />

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label className="text-[13px] font-medium text-[#1D1D1F]">
                    Dry Run Mode (Mock / Practice)
                  </Label>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF9500]/10 text-[#B25E00] border border-[#FF9500]/30 font-medium">
                    Testing
                  </span>
                </div>
                <p className="text-[11px] text-[#6E6E73]">
                  Marks student attempts as practice dry runs without polluting official evaluation statistics.
                </p>
              </div>
              <Switch
                checked={isDryRun}
                onCheckedChange={setIsDryRun}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Schedule */}
        <div className="bg-white border border-[#D2D2D7] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#0071E3] font-semibold text-[13px]">
            <Calendar className="size-4" />
            <span>Assessment Schedule Window (Optional)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="startsAt" className="text-[12px] font-medium text-[#1D1D1F]">
                Starts At (Local Time)
              </Label>
              <Input
                id="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] h-10 text-[13px] rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endsAt" className="text-[12px] font-medium text-[#1D1D1F]">
                Ends At (Local Time)
              </Label>
              <Input
                id="endsAt"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] h-10 text-[13px] rounded-xl focus-visible:bg-white focus-visible:border-[#0071E3]"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            asChild
            type="button"
            variant="outline"
            className="border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-xl h-10 text-[13px]"
          >
            <Link href="/admin/exams">Cancel</Link>
          </Button>

          <Button
            type="submit"
            disabled={submitting || loadingSubjects}
            className="bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl h-10 px-6 text-[13px] font-medium shadow-xs"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Creating Exam...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4" />
                <span>Create Exam</span>
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
