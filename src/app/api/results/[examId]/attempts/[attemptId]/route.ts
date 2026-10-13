import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrivilegedSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ examId: string; attemptId: string }> }
) {
  try {
    const { examId, attemptId } = await context.params;

    if (!examId || !attemptId) {
      return NextResponse.json(
        { error: "examId and attemptId are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Require admin auth
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : undefined;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(bearerToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const privilegedClient = await getPrivilegedSupabaseClient();

    const { data: profile } = await privilegedClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Admin authorization required" },
        { status: 403 }
      );
    }

    // 2. Fetch exam configuration
    const { data: examData } = await privilegedClient
      .from("exams")
      .select("marks_per_question, negative_marks")
      .eq("id", examId)
      .maybeSingle();

    const positiveMarks = examData?.marks_per_question ?? 4;
    const negativeMarks = examData?.negative_marks ?? 1;

    // 3. Fetch attempt
    const { data: attempt, error: attemptError } = await privilegedClient
      .from("exam_attempts")
      .select(`
        id,
        exam_id,
        student_id,
        started_at,
        submitted_at,
        is_auto_submitted,
        is_dry_run,
        score,
        total_correct,
        total_incorrect,
        total_unanswered,
        status,
        proctor_log,
        profiles:student_id (
          id,
          full_name,
          email
        )
      `)
      .eq("id", attemptId)
      .eq("exam_id", examId)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: "Attempt record not found" },
        { status: 404 }
      );
    }

    // 4. Fetch responses with questions
    const { data: responses, error: respError } = await privilegedClient
      .from("exam_responses")
      .select(`
        id,
        question_id,
        question_order,
        selected_option,
        is_marked_for_review,
        questions:question_id (
          id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_option
        )
      `)
      .eq("attempt_id", attemptId)
      .order("question_order", { ascending: true });

    if (respError) {
      return NextResponse.json(
        { error: "Failed to fetch attempt responses: " + respError.message },
        { status: 500 }
      );
    }

    const studentProfile = attempt.profiles as unknown as {
      id: string;
      full_name: string | null;
      email: string | null;
    } | null;

    const formattedResponses = (responses || []).map((r) => {
      const q = r.questions as unknown as {
        id: string;
        question_text: string;
        option_a: string;
        option_b: string;
        option_c: string;
        option_d: string;
        correct_option: string;
        explanation: string | null;
      } | null;

      const selected = r.selected_option;
      const correct = q?.correct_option || "";
      const isUnanswered = !selected;
      const isCorrect = isUnanswered
        ? null
        : selected.trim().toUpperCase() === correct.trim().toUpperCase();
      const marksAwarded = isUnanswered
        ? 0
        : isCorrect
        ? positiveMarks
        : -negativeMarks;

      return {
        response_id: r.id,
        question_id: r.question_id,
        question_order: r.question_order,
        question_text: q?.question_text || "",
        options: {
          A: q?.option_a || "",
          B: q?.option_b || "",
          C: q?.option_c || "",
          D: q?.option_d || "",
        },
        selected_option: r.selected_option,
        correct_option: correct,
        is_correct: isCorrect,
        marks_awarded: marksAwarded,
        explanation: q?.explanation || "",
      };
    });

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        exam_id: attempt.exam_id,
        student_id: attempt.student_id,
        student_name: studentProfile?.full_name || "Unknown Student",
        student_email: studentProfile?.email || "No email",
        score: attempt.score,
        total_correct: attempt.total_correct,
        total_incorrect: attempt.total_incorrect,
        total_unanswered: attempt.total_unanswered,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
        is_auto_submitted: attempt.is_auto_submitted,
        is_dry_run: attempt.is_dry_run,
        status: attempt.status,
        proctor_log: attempt.proctor_log,
      },
      responses: formattedResponses,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
