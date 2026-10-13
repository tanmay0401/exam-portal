"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  // Computed max marks
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
      {/* Top breadcrumb & back button */}
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Create New Examination
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure examination structure, scoring rules, multi-batch settings, and session schedule.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Info */}
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <BookOpen className="size-4" />
              <span>Basic Information</span>
            </div>
            <CardTitle className="text-lg text-white">Exam Details & Subject</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Provide descriptive identity and assign an accredited question bank subject.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-xs font-semibold text-slate-300">
                Exam Title <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Data Structures & Algorithms Mid-Term Examination 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 h-9 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject" className="text-xs font-semibold text-slate-300">
                Subject Bank <span className="text-rose-400">*</span>
              </Label>
              {loadingSubjects ? (
                <div className="h-9 w-full bg-slate-950/60 rounded-lg border border-slate-800 flex items-center px-3 text-xs text-slate-400 gap-2">
                  <Loader2 className="size-3.5 animate-spin text-indigo-400" />
                  <span>Loading subjects...</span>
                </div>
              ) : subjects.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>
                    No subjects found in the database. Please create a subject and add questions first.
                  </span>
                </div>
              ) : (
                <Select
                  value={subjectId}
                  onValueChange={(val) => setSubjectId(val as string)}
                >
                  <SelectTrigger className="w-full bg-slate-950 border-slate-800 text-white h-9 text-sm">
                    <SelectValue placeholder="Select a subject..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="hover:bg-slate-800">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Configuration & Scoring */}
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Settings2 className="size-4" />
              <span>Assessment & Scoring Rules</span>
            </div>
            <CardTitle className="text-lg text-white">Question Count & Marks</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Establish question volume, timing limits, positive scoring, and negative penalization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalQuestions" className="text-xs font-semibold text-slate-300">
                  Total Questions <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="totalQuestions"
                  type="number"
                  min={1}
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(e.target.value)}
                  required
                  className="bg-slate-950 border-slate-800 text-white h-9 text-sm font-mono"
                />
                <p className="text-[11px] text-slate-500">
                  Number of questions drawn into each candidate&apos;s exam paper.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration" className="text-xs font-semibold text-slate-300">
                  Duration (Minutes) <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  required
                  className="bg-slate-950 border-slate-800 text-white h-9 text-sm font-mono"
                />
                <p className="text-[11px] text-slate-500">
                  Countdown limit before auto-submission triggers.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="marksPerQuestion" className="text-xs font-semibold text-slate-300">
                  Marks per Correct Question
                </Label>
                <Input
                  id="marksPerQuestion"
                  type="number"
                  step="0.5"
                  min={0.5}
                  value={marksPerQuestion}
                  onChange={(e) => setMarksPerQuestion(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white h-9 text-sm font-mono"
                />
                <p className="text-[11px] text-slate-500">Default: 4 marks per correct response.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="negativeMarks" className="text-xs font-semibold text-slate-300">
                  Negative Marks per Incorrect Question
                </Label>
                <Input
                  id="negativeMarks"
                  type="number"
                  step="0.25"
                  min={0}
                  value={negativeMarks}
                  onChange={(e) => setNegativeMarks(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white h-9 text-sm font-mono"
                />
                <p className="text-[11px] text-slate-500">
                  Deducted marks for incorrect choices (default: 1 mark penalty).
                </p>
              </div>
            </div>

            {/* Computed Max Marks Banner */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Calculator className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-indigo-300">Computed Maximum Score</div>
                  <div className="text-[11px] text-slate-400">
                    {parsedTotalQuestions} questions × {parsedMarksPerQuestion} marks
                  </div>
                </div>
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {computedMaxMarks} <span className="text-xs font-normal text-slate-400">pts</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Advanced Batch & Security Options */}
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Layers className="size-4" />
              <span>Multi-Batch Generation & Test Mode</span>
            </div>
            <CardTitle className="text-lg text-white">Randomization & Anti-Malpractice</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Configure randomized sets for multi-batch testing or practice dry-runs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="batchCount" className="text-xs font-semibold text-slate-300">
                Number of Batches to Generate (Default: 3)
              </Label>
              <Input
                id="batchCount"
                type="number"
                min={1}
                max={20}
                value={batchCount}
                onChange={(e) => setBatchCount(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white h-9 text-sm font-mono max-w-xs"
              />
              <p className="text-[11px] text-slate-500">
                Independent test paper variations generated algorithmically.
              </p>
            </div>

            <Separator className="bg-slate-800/80" />

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-slate-200">
                  Allow Question Overlap Between Batches
                </Label>
                <p className="text-[11px] text-slate-400">
                  When disabled, questions will not be reused across batches if the question bank contains sufficient pool size.
                </p>
              </div>
              <Switch
                checked={allowQuestionReuse}
                onCheckedChange={setAllowQuestionReuse}
              />
            </div>

            <Separator className="bg-slate-800/80" />

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold text-slate-200">
                    Dry Run Mode (Mock / Practice)
                  </Label>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Testing
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Marks candidate attempts as simulated dry runs without affecting permanent score statistics.
                </p>
              </div>
              <Switch
                checked={isDryRun}
                onCheckedChange={setIsDryRun}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Schedule */}
        <Card className="border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Calendar className="size-4" />
              <span>Assessment Window (Optional)</span>
            </div>
            <CardTitle className="text-lg text-white">Start & Expiration Schedule</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Optionally enforce time boundaries within which students may initiate the test.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startsAt" className="text-xs font-semibold text-slate-300">
                  Starts At (Local Time)
                </Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endsAt" className="text-xs font-semibold text-slate-300">
                  Ends At (Local Time)
                </Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white h-9 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            asChild
            type="button"
            variant="outline"
            className="border-slate-800 text-slate-300 hover:bg-slate-900"
          >
            <Link href="/admin/exams">Cancel</Link>
          </Button>

          <Button
            type="submit"
            disabled={submitting || loadingSubjects}
            className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-36 shadow-lg shadow-indigo-600/25"
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
