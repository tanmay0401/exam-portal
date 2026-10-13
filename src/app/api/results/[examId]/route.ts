import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await context.params;

    if (!examId) {
      return NextResponse.json(
        { error: "examId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Require admin auth
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

    const { data: profile } = await supabase
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

    // 2. Fetch exam info
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("id, title, max_marks, total_questions, duration_minutes, status")
      .eq("id", examId)
      .maybeSingle();

    if (examError || !exam) {
      return NextResponse.json(
        { error: "Exam not found" },
        { status: 404 }
      );
    }

    // 3. Parse query filters (?dry_run=true|false)
    const searchParams = request.nextUrl.searchParams;
    const dryRunParam = searchParams.get("dry_run");

    let query = supabase
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
      .eq("exam_id", examId)
      .order("score", { ascending: false, nullsFirst: false });

    if (dryRunParam !== null && dryRunParam !== undefined) {
      if (dryRunParam === "true") {
        query = query.eq("is_dry_run", true);
      } else if (dryRunParam === "false") {
        query = query.eq("is_dry_run", false);
      }
    }

    const { data: attempts, error: attemptsError } = await query;

    if (attemptsError) {
      return NextResponse.json(
        { error: "Failed to fetch exam results: " + attemptsError.message },
        { status: 500 }
      );
    }

    // 4. Transform results with proctor warnings count and summary
    const formattedAttempts = (attempts || []).map((attempt) => {
      const studentProfile = attempt.profiles as unknown as {
        id: string;
        full_name: string | null;
        email: string | null;
      } | null;

      const proctorLog = Array.isArray(attempt.proctor_log)
        ? (attempt.proctor_log as Array<{ event_type: string; timestamp: string; details?: unknown }>)
        : [];

      // Calculate warnings count: tab_hidden, fullscreen_exit, face_not_detected, multiple_faces, head_turned, etc.
      const warningEvents = proctorLog.filter((log) =>
        [
          "tab_hidden",
          "fullscreen_exit",
          "face_not_detected",
          "multiple_faces_detected",
          "head_turned_away",
          "looking_down",
          "gaze_away",
          "background_person_detected",
          "audio_disturbance",
        ].includes(log.event_type)
      );

      return {
        id: attempt.id,
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
        warnings_count: warningEvents.length,
        proctor_log_summary: {
          total_events: proctorLog.length,
          tab_switches: proctorLog.filter((l) => l.event_type === "tab_hidden").length,
          fullscreen_exits: proctorLog.filter((l) => l.event_type === "fullscreen_exit").length,
          face_losses: proctorLog.filter((l) => l.event_type === "face_not_detected").length,
          multiple_faces: proctorLog.filter((l) =>
            ["multiple_faces_detected", "background_person_detected"].includes(l.event_type)
          ).length,
          head_turns: proctorLog.filter((l) => l.event_type === "head_turned_away").length,
          looking_down: proctorLog.filter((l) => l.event_type === "looking_down").length,
          gaze_away: proctorLog.filter((l) => l.event_type === "gaze_away").length,
        },
        proctor_log: proctorLog,
      };
    });

    return NextResponse.json({
      exam: {
        id: exam.id,
        title: exam.title,
        max_marks: exam.max_marks,
        total_questions: exam.total_questions,
      },
      attempts: formattedAttempts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
