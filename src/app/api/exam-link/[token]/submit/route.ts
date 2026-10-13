import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const { attempt_id, is_auto_submitted = false } = body;

    if (!attempt_id) {
      return NextResponse.json(
        { error: "Attempt ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Require student auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Validate attempt ownership and status
    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts")
      .select("id, student_id, started_at, status, score, total_correct, total_incorrect, total_unanswered, is_auto_submitted, exam_id, exams(id, title, marks_per_question, negative_marks, max_marks, ends_at, duration_minutes)")
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

    const exam = attempt.exams as unknown as {
      id: string;
      title: string;
      marks_per_question: number;
      negative_marks: number;
      max_marks: number;
      ends_at: string | null;
      duration_minutes: number;
    } | null;

    if (!exam) {
      return NextResponse.json(
        { error: "Associated exam could not be loaded" },
        { status: 404 }
      );
    }

    // If already graded/submitted, return current score summary
    if (attempt.status === "graded" || attempt.status === "submitted") {
      const maxMarks = exam.max_marks || 100;
      const score = attempt.score ?? 0;
      const percentage = maxMarks > 0 ? Math.round((Math.max(0, score) / maxMarks) * 1000) / 10 : 0;

      return NextResponse.json({
        message: "Attempt already submitted",
        attempt_id: attempt.id,
        score: attempt.score,
        total_correct: attempt.total_correct,
        total_incorrect: attempt.total_incorrect,
        total_unanswered: attempt.total_unanswered,
        max_marks: maxMarks,
        percentage,
        is_auto_submitted: attempt.is_auto_submitted,
      });
    }

    // 3. Check deadlines
    const now = new Date();
    let autoSubmitFlag = Boolean(is_auto_submitted);

    if (exam.ends_at && now > new Date(exam.ends_at)) {
      autoSubmitFlag = true;
    }

    const durationLimitMs = (exam.duration_minutes || 60) * 60 * 1000;
    if (now.getTime() - new Date(attempt.started_at).getTime() > durationLimitMs) {
      autoSubmitFlag = true;
    }

    // 4. Fetch all responses for this attempt
    const { data: responses, error: respError } = await supabase
      .from("exam_responses")
      .select("question_id, selected_option")
      .eq("attempt_id", attempt_id);

    if (respError || !responses) {
      return NextResponse.json(
        { error: "Failed to retrieve student responses" },
        { status: 500 }
      );
    }

    // 5. Fetch correct answers from questions table (SERVER ONLY)
    const questionIds = responses.map((r) => r.question_id);
    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("id, correct_option")
      .in("id", questionIds);

    if (qError || !questions) {
      return NextResponse.json(
        { error: "Failed to evaluate questions" },
        { status: 500 }
      );
    }

    const correctMap = new Map(questions.map((q) => [q.id, q.correct_option]));

    // 6. Calculate Score (+4 correct, -1 incorrect, 0 unanswered or custom values)
    const positiveMarks = exam.marks_per_question ?? 4;
    const negativeMarks = exam.negative_marks ?? 1;

    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalUnanswered = 0;
    let calculatedScore = 0;

    for (const resp of responses) {
      const selected = resp.selected_option;
      const correct = correctMap.get(resp.question_id);

      if (!selected) {
        totalUnanswered += 1;
      } else if (selected.trim().toUpperCase() === correct?.trim().toUpperCase()) {
        totalCorrect += 1;
        calculatedScore += positiveMarks;
      } else {
        totalIncorrect += 1;
        calculatedScore -= negativeMarks;
      }
    }

    const submittedAt = now.toISOString();

    // 7. Update exam_attempt: score, total_correct, total_incorrect, total_unanswered, submitted_at, status='graded'
    const { error: updateError } = await supabase
      .from("exam_attempts")
      .update({
        score: calculatedScore,
        total_correct: totalCorrect,
        total_incorrect: totalIncorrect,
        total_unanswered: totalUnanswered,
        submitted_at: submittedAt,
        status: "graded",
        is_auto_submitted: autoSubmitFlag,
      })
      .eq("id", attempt_id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to record final attempt score: " + updateError.message },
        { status: 500 }
      );
    }

    const maxMarks = exam.max_marks || (responses.length * positiveMarks);
    const percentage = maxMarks > 0 ? Math.round((Math.max(0, calculatedScore) / maxMarks) * 1000) / 10 : 0;

    // Return the score summary (WITHOUT correct answers)
    return NextResponse.json({
      success: true,
      attempt_id: attempt.id,
      score: calculatedScore,
      total_correct: totalCorrect,
      total_incorrect: totalIncorrect,
      total_unanswered: totalUnanswered,
      max_marks: maxMarks,
      percentage,
      is_auto_submitted: autoSubmitFlag,
      submitted_at: submittedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
