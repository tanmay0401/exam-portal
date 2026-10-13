import { NextRequest, NextResponse } from "next/server";
import { getPrivilegedSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-user";

export async function POST(
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

    const body = await request.json();
    const { attempt_id, responses } = body;

    if (!attempt_id || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: "Invalid payload: attempt_id and responses array required" },
        { status: 400 }
      );
    }

    const privilegedClient = await getPrivilegedSupabaseClient();

    // 1. Require candidate auth
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Validate attempt and ownership
    const { data: attempt, error: attemptError } = await privilegedClient
      .from("exam_attempts")
      .select("id, student_id, started_at, status, exam_id, exams(duration_minutes, ends_at, exam_link_token)")
      .eq("id", attempt_id)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (attempt.student_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized access to this attempt" },
        { status: 403 }
      );
    }

    if (attempt.status !== "in_progress") {
      return NextResponse.json(
        { error: "Exam attempt is already submitted or graded" },
        { status: 400 }
      );
    }

    // 3. Server-side deadline enforcement
    const exam = attempt.exams as unknown as {
      duration_minutes: number;
      ends_at: string | null;
      exam_link_token: string | null;
    } | null;

    if (exam) {
      const now = Date.now();
      const gracePeriodMs = 60 * 1000; // 60s network grace period

      const durationMs = (exam.duration_minutes || 60) * 60 * 1000;
      const attemptDeadline = new Date(attempt.started_at).getTime() + durationMs + gracePeriodMs;

      let effectiveDeadline = attemptDeadline;
      if (exam.ends_at) {
        const examEndDeadline = new Date(exam.ends_at).getTime() + gracePeriodMs;
        effectiveDeadline = Math.min(effectiveDeadline, examEndDeadline);
      }

      if (now > effectiveDeadline) {
        return NextResponse.json(
          { error: "Exam time limit has expired. Please submit your attempt.", expired: true },
          { status: 403 }
        );
      }
    }

    // 4. Update responses in database
    const nowIso = new Date().toISOString();
    const updatePromises = responses.map(
      (resp: {
        question_id: string;
        selected_option?: string | null;
        is_marked_for_review?: boolean;
      }) =>
        privilegedClient
          .from("exam_responses")
          .update({
            selected_option: resp.selected_option !== undefined ? resp.selected_option : null,
            is_marked_for_review: Boolean(resp.is_marked_for_review),
            updated_at: nowIso,
          })
          .eq("attempt_id", attempt_id)
          .eq("question_id", resp.question_id)
    );

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      saved_count: responses.length,
      timestamp: nowIso,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
