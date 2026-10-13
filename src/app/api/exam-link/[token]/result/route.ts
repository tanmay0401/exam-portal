import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrivilegedSupabaseClient } from "@/lib/supabase/admin";

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

    const privilegedClient = await getPrivilegedSupabaseClient();

    // 2. Resolve exam by token with subject details
    const { data: exam, error: examError } = await privilegedClient
      .from("exams")
      .select("id, title, max_marks, marks_per_question, total_questions, subject_id, subjects(name)")
      .eq("exam_link_token", token)
      .maybeSingle();

    if (examError || !exam) {
      return NextResponse.json(
        { error: "Exam not found" },
        { status: 404 }
      );
    }

    // 3. Fetch candidate profile
    const { data: profile } = await privilegedClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    // Check optional attempt_id query parameter
    const searchParams = request.nextUrl.searchParams;
    const attemptId = searchParams.get("attempt_id");

    let attemptQuery = privilegedClient
      .from("exam_attempts")
      .select("id, student_id, score, total_correct, total_incorrect, total_unanswered, is_auto_submitted, submitted_at, status")
      .eq("exam_id", exam.id)
      .eq("student_id", user.id);

    if (attemptId) {
      attemptQuery = attemptQuery.eq("id", attemptId);
    } else {
      attemptQuery = attemptQuery.order("started_at", { ascending: false }).limit(1);
    }

    const { data: attempts, error: attemptError } = await attemptQuery;

    if (attemptError || !attempts || attempts.length === 0) {
      return NextResponse.json(
        { error: "No completed exam attempt found for this student" },
        { status: 404 }
      );
    }

    const attempt = attempts[0];

    // Validate ownership
    if (attempt.student_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized access to this result" },
        { status: 403 }
      );
    }

    const subjectName = (exam.subjects as unknown as { name: string } | null)?.name || "General";
    const studentName = profile?.full_name || user.user_metadata?.full_name || profile?.email || user.email || "Candidate";
    const studentEmail = profile?.email || user.email || "";

    const maxMarks = exam.max_marks || ((exam.marks_per_question || 4) * (exam.total_questions || 25));
    const score = attempt.score ?? 0;
    const percentage = maxMarks > 0 ? Math.round((Math.max(0, score) / maxMarks) * 1000) / 10 : 0;

    const payload = {
      attempt_id: attempt.id,
      exam_title: exam.title,
      subject_name: subjectName,
      student_name: studentName,
      student_email: studentEmail,
      score: attempt.score,
      total_correct: attempt.total_correct,
      total_incorrect: attempt.total_incorrect,
      total_unanswered: attempt.total_unanswered,
      max_marks: maxMarks,
      percentage,
      is_auto_submitted: attempt.is_auto_submitted,
      submitted_at: attempt.submitted_at,
      status: attempt.status,
    };

    return NextResponse.json({
      ...payload,
      result: payload,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
