import { NextRequest, NextResponse } from "next/server";
import { getPrivilegedSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token || typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { error: "Examination token is required in URL" },
        { status: 400 }
      );
    }

    const cleanToken = token.trim();
    const supabase = await getPrivilegedSupabaseClient();

    // Query exam by unique exam_link_token with subject details
    const { data: exam, error } = await supabase
      .from("exams")
      .select(`
        id,
        title,
        duration_minutes,
        total_questions,
        marks_per_question,
        negative_marks,
        max_marks,
        status,
        starts_at,
        ends_at,
        is_dry_run,
        published_at,
        subjects (
          id,
          name
        )
      `)
      .eq("exam_link_token", cleanToken)
      .maybeSingle();

    if (error) {
      console.error("Database error looking up exam link token:", error);
      return NextResponse.json(
        { error: "Database error resolving exam link. Please try again." },
        { status: 500 }
      );
    }

    if (!exam) {
      return NextResponse.json(
        {
          error: "Exam not found or invalid link. Please verify the URL provided by your administrator or institution.",
          invalidToken: true,
        },
        { status: 404 }
      );
    }

    const subjectObj = exam.subjects as unknown as { id: string; name: string } | null;
    const subjectName = subjectObj?.name || null;

    if (exam.status === "draft") {
      return NextResponse.json(
        {
          error: "This examination is currently in draft mode and has not yet been published by the administrator.",
          status: "draft",
          title: exam.title,
        },
        { status: 400 }
      );
    }

    if (exam.status === "closed") {
      return NextResponse.json(
        {
          error: "This examination session has been closed by the administrator. No further attempts can be started.",
          status: "closed",
          title: exam.title,
        },
        { status: 403 }
      );
    }

    const now = new Date();

    if (exam.starts_at && new Date(exam.starts_at) > now) {
      return NextResponse.json(
        {
          error: `This examination is scheduled to begin on ${new Date(exam.starts_at).toLocaleString()}. Access will open at that time.`,
          scheduled: true,
          starts_at: exam.starts_at,
          exam: {
            id: exam.id,
            title: exam.title,
            subject_name: subjectName,
            duration_minutes: exam.duration_minutes,
            total_questions: exam.total_questions,
            max_marks: exam.max_marks,
            starts_at: exam.starts_at,
            ends_at: exam.ends_at,
          },
        },
        { status: 403 }
      );
    }

    if (exam.ends_at && new Date(exam.ends_at) < now) {
      return NextResponse.json(
        {
          error: `This examination session concluded on ${new Date(exam.ends_at).toLocaleString()}. New attempts are no longer accepted.`,
          concluded: true,
          ends_at: exam.ends_at,
          exam: {
            id: exam.id,
            title: exam.title,
            subject_name: subjectName,
            duration_minutes: exam.duration_minutes,
            total_questions: exam.total_questions,
            max_marks: exam.max_marks,
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        subject_name: subjectName,
        duration_minutes: exam.duration_minutes,
        total_questions: exam.total_questions,
        marks_per_question: exam.marks_per_question,
        negative_marks: exam.negative_marks,
        max_marks: exam.max_marks,
        status: exam.status,
        starts_at: exam.starts_at,
        ends_at: exam.ends_at,
        is_dry_run: exam.is_dry_run,
        published_at: exam.published_at,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Exam link route exception:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
