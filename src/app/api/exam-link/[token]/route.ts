import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        { error: "Exam token is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: exam, error } = await supabase
      .from("exams")
      .select(
        "id, title, duration_minutes, total_questions, marks_per_question, negative_marks, max_marks, status, starts_at, ends_at, is_dry_run"
      )
      .eq("exam_link_token", token)
      .maybeSingle();

    if (error || !exam) {
      return NextResponse.json(
        { error: "Exam not found or invalid link" },
        { status: 404 }
      );
    }

    if (exam.status !== "published") {
      return NextResponse.json(
        { error: "This exam is not currently active" },
        { status: 404 }
      );
    }

    const now = new Date();

    if (exam.starts_at && new Date(exam.starts_at) > now) {
      return NextResponse.json(
        {
          error: "This exam has not started yet",
          starts_at: exam.starts_at,
          exam: {
            title: exam.title,
            duration_minutes: exam.duration_minutes,
            total_questions: exam.total_questions,
            max_marks: exam.max_marks,
          },
        },
        { status: 403 }
      );
    }

    if (exam.ends_at && new Date(exam.ends_at) < now) {
      return NextResponse.json(
        { error: "This exam has already concluded" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      exam: {
        id: exam.id,
        title: exam.title,
        duration_minutes: exam.duration_minutes,
        total_questions: exam.total_questions,
        marks_per_question: exam.marks_per_question,
        negative_marks: exam.negative_marks,
        max_marks: exam.max_marks,
        starts_at: exam.starts_at,
        ends_at: exam.ends_at,
        is_dry_run: exam.is_dry_run,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
