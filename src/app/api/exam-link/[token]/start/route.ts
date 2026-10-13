import { NextRequest, NextResponse } from "next/server";
import { getPrivilegedSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-user";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token || typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { error: "Examination token is required" },
        { status: 400 }
      );
    }

    const cleanToken = token.trim();
    const privilegedClient = await getPrivilegedSupabaseClient();

    // 1. Require candidate authentication via active session or candidate cookie
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication required to start examination. Please sign in as an authorized candidate first.",
        },
        { status: 401 }
      );
    }

    // 3. Validate exam by token
    const { data: exam, error: examError } = await privilegedClient
      .from("exams")
      .select(
        "id, title, duration_minutes, total_questions, status, starts_at, ends_at, is_dry_run, selected_batch_id, subject_id"
      )
      .eq("exam_link_token", cleanToken)
      .maybeSingle();

    if (examError || !exam) {
      return NextResponse.json(
        { error: "Exam not found or invalid link" },
        { status: 404 }
      );
    }

    if (exam.status !== "published") {
      return NextResponse.json(
        { error: "This exam is not active" },
        { status: 403 }
      );
    }

    const now = new Date();
    if (exam.starts_at && new Date(exam.starts_at) > now) {
      return NextResponse.json(
        { error: "This exam has not started yet" },
        { status: 403 }
      );
    }

    if (exam.ends_at && new Date(exam.ends_at) < now) {
      return NextResponse.json(
        { error: "This exam has concluded" },
        { status: 403 }
      );
    }

    // 4. Check if candidate already has an attempt for this exam
    const { data: existingAttempts, error: attemptCheckError } = await privilegedClient
      .from("exam_attempts")
      .select("id, status, started_at, batch_id")
      .eq("exam_id", exam.id)
      .eq("student_id", user.id)
      .order("started_at", { ascending: false });

    if (attemptCheckError) {
      return NextResponse.json(
        { error: "Failed to check previous attempts: " + attemptCheckError.message },
        { status: 500 }
      );
    }

    const existingAttempt = existingAttempts && existingAttempts.length > 0 ? existingAttempts[0] : null;

    if (existingAttempt) {
      if (existingAttempt.status === "submitted" || existingAttempt.status === "graded") {
        return NextResponse.json(
          { error: "You have already completed this examination. Retakes are not permitted." },
          { status: 400 }
        );
      }

      if (existingAttempt.status === "in_progress") {
        // Return existing in-progress attempt to allow graceful page reload / reconnect
        const { data: responses } = await privilegedClient
          .from("exam_responses")
          .select("question_id, question_order, selected_option, is_marked_for_review")
          .eq("attempt_id", existingAttempt.id)
          .order("question_order", { ascending: true });

        const questionIds = responses?.map((r) => r.question_id) || [];
        let questions: Array<{
          id: string;
          question_text: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          question_order: number;
        }> = [];

        if (questionIds.length > 0) {
          const { data: questionData } = await privilegedClient
            .from("questions")
            .select("id, question_text, option_a, option_b, option_c, option_d")
            .in("id", questionIds);

          const questionMap = new Map((questionData || []).map((q) => [q.id, q]));
          questions = (responses || []).map((r) => {
            const q = questionMap.get(r.question_id);
            return {
              id: r.question_id,
              question_text: q?.question_text || "",
              option_a: q?.option_a || "",
              option_b: q?.option_b || "",
              option_c: q?.option_c || "",
              option_d: q?.option_d || "",
              question_order: r.question_order,
            };
          });
        }

        return NextResponse.json({
          attempt_id: existingAttempt.id,
          started_at: existingAttempt.started_at,
          duration_minutes: exam.duration_minutes,
          resumed: true,
          questions,
          saved_responses: (responses || []).map((r) => ({
            question_id: r.question_id,
            selected_option: r.selected_option,
            is_marked_for_review: r.is_marked_for_review,
          })),
        });
      }
    }

    // 5. Resolve the batch to use
    let targetBatchId = exam.selected_batch_id;

    if (!targetBatchId) {
      const { data: firstBatch } = await privilegedClient
        .from("exam_batches")
        .select("id")
        .eq("exam_id", exam.id)
        .order("batch_number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstBatch) {
        targetBatchId = firstBatch.id;
      }
    }

    // 6. Fetch batch questions using elevated server client (bypasses RLS circular attempt dependency)
    interface QuestionItem {
      id: string;
      question_text: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      question_order: number;
    }

    let questions: QuestionItem[] = [];

    if (targetBatchId) {
      const { data: batchQuestions, error: bqError } = await privilegedClient
        .from("exam_batch_questions")
        .select("question_id, question_order, questions(id, question_text, option_a, option_b, option_c, option_d)")
        .eq("batch_id", targetBatchId)
        .order("question_order", { ascending: true });

      if (!bqError && batchQuestions && batchQuestions.length > 0) {
        questions = batchQuestions
          .filter((bq) => bq.questions !== null)
          .map((bq) => {
            const q = bq.questions as unknown as {
              id: string;
              question_text: string;
              option_a: string;
              option_b: string;
              option_c: string;
              option_d: string;
            };
            return {
              id: q.id,
              question_text: q.question_text,
              option_a: q.option_a,
              option_b: q.option_b,
              option_c: q.option_c,
              option_d: q.option_d,
              question_order: bq.question_order,
            };
          });
      }
    }

    // Fallback if no batch questions found: get questions by subject
    if (questions.length === 0 && exam.subject_id) {
      const { data: rawQuestions } = await privilegedClient
        .from("questions")
        .select("id, question_text, option_a, option_b, option_c, option_d")
        .eq("subject_id", exam.subject_id)
        .limit(exam.total_questions || 30);

      if (rawQuestions && rawQuestions.length > 0) {
        questions = rawQuestions.map((q, idx) => ({
          ...q,
          question_order: idx + 1,
        }));
      }
    }

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No questions configured for this exam" },
        { status: 400 }
      );
    }

    // 7. Create exam_attempt record bound to this candidate
    const startedAt = new Date().toISOString();
    const { data: newAttempt, error: createAttemptError } = await privilegedClient
      .from("exam_attempts")
      .insert({
        exam_id: exam.id,
        student_id: user.id,
        batch_id: targetBatchId,
        started_at: startedAt,
        status: "in_progress",
        is_auto_submitted: false,
        is_dry_run: exam.is_dry_run ?? false,
        score: null,
        total_correct: 0,
        total_incorrect: 0,
        total_unanswered: questions.length,
        proctor_log: [],
      })
      .select()
      .single();

    if (createAttemptError || !newAttempt) {
      return NextResponse.json(
        { error: "Failed to initialize exam attempt: " + createAttemptError?.message },
        { status: 500 }
      );
    }

    // 8. Create exam_responses records
    const responsesPayload = questions.map((q, idx) => ({
      attempt_id: newAttempt.id,
      question_id: q.id,
      question_order: q.question_order ?? idx + 1,
      selected_option: null,
      is_marked_for_review: false,
      updated_at: startedAt,
    }));

    const { error: insertResponsesError } = await privilegedClient
      .from("exam_responses")
      .insert(responsesPayload);

    if (insertResponsesError) {
      return NextResponse.json(
        { error: "Failed to initialize question responses: " + insertResponsesError.message },
        { status: 500 }
      );
    }

    // 9. Return attempt_id and questions (WITHOUT correct_option answer keys)
    return NextResponse.json({
      attempt_id: newAttempt.id,
      started_at: startedAt,
      duration_minutes: exam.duration_minutes,
      resumed: false,
      questions,
      saved_responses: [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
