import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-admin";

export async function GET() {
  const { errorResponse, supabase } = await authenticateAdmin();
  if (errorResponse) return errorResponse;

  const { data: exams, error } = await supabase
    .from("exams")
    .select(`
      *,
      subjects (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ exams: exams || [] });
}

export async function POST(request: Request) {
  const { errorResponse, user, supabase } = await authenticateAdmin();
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const {
      title,
      subject_id,
      total_questions,
      marks_per_question = 4,
      negative_marks = 1,
      duration_minutes,
      batch_count = 3,
      allow_question_reuse = true,
      is_dry_run = false,
      starts_at,
      ends_at,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Exam title is required." }, { status: 400 });
    }

    if (!subject_id) {
      return NextResponse.json({ error: "Subject selection is required." }, { status: 400 });
    }

    const parsedTotalQuestions = Number(total_questions);
    if (isNaN(parsedTotalQuestions) || parsedTotalQuestions <= 0) {
      return NextResponse.json(
        { error: "Total questions must be a positive number." },
        { status: 400 }
      );
    }

    const parsedDuration = Number(duration_minutes);
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      return NextResponse.json(
        { error: "Duration (minutes) must be a positive number." },
        { status: 400 }
      );
    }

    const parsedMarksPerQuestion = Number(marks_per_question);
    const parsedNegativeMarks = Number(negative_marks);
    const parsedBatchCount = Number(batch_count);

    if (isNaN(parsedBatchCount) || parsedBatchCount < 1) {
      return NextResponse.json(
        { error: "Batch count must be at least 1." },
        { status: 400 }
      );
    }

    // Validate available questions for this subject
    const { count: availableQuestionsCount, error: countError } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("subject_id", subject_id);

    if (countError) {
      return NextResponse.json(
        { error: `Failed to check question bank: ${countError.message}` },
        { status: 500 }
      );
    }

    const availableCount = availableQuestionsCount ?? 0;
    if (availableCount < parsedTotalQuestions) {
      return NextResponse.json(
        {
          error: `Subject only has ${availableCount} question(s) available, but ${parsedTotalQuestions} questions were requested. Please reduce question count or add more questions to the subject.`,
        },
        { status: 400 }
      );
    }

    // Format optional start and end times
    let formattedStartsAt: string | null = null;
    let formattedEndsAt: string | null = null;

    if (starts_at) {
      const d = new Date(starts_at);
      if (!isNaN(d.getTime())) {
        formattedStartsAt = d.toISOString();
      }
    }

    if (ends_at) {
      const d = new Date(ends_at);
      if (!isNaN(d.getTime())) {
        formattedEndsAt = d.toISOString();
      }
    }

    if (formattedStartsAt && formattedEndsAt && new Date(formattedEndsAt) <= new Date(formattedStartsAt)) {
      return NextResponse.json(
        { error: "Exam end time must be after start time." },
        { status: 400 }
      );
    }

    const { data: createdExam, error: insertError } = await supabase
      .from("exams")
      .insert({
        title: title.trim(),
        subject_id,
        total_questions: parsedTotalQuestions,
        marks_per_question: parsedMarksPerQuestion,
        negative_marks: parsedNegativeMarks,
        duration_minutes: parsedDuration,
        batch_count: parsedBatchCount,
        allow_question_reuse: Boolean(allow_question_reuse),
        is_dry_run: Boolean(is_dry_run),
        status: "draft",
        starts_at: formattedStartsAt,
        ends_at: formattedEndsAt,
        created_by: user.id,
      })
      .select(`
        *,
        subjects (
          id,
          name
        )
      `)
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ exam: createdExam }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
