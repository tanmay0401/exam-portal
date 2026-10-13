import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Json } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attempt_id, event_type, timestamp, details } = body;

    if (!attempt_id || !event_type) {
      return NextResponse.json(
        { error: "attempt_id and event_type are required" },
        { status: 400 }
      );
    }

    const validEvents = [
      "tab_hidden",
      "tab_visible",
      "fullscreen_exit",
      "fullscreen_enter",
      "face_not_detected",
      "face_detected",
      "multiple_faces_detected",
      "head_turned_away",
      "looking_down",
      "gaze_away",
      "background_person_detected",
      "audio_disturbance",
    ];

    if (!validEvents.includes(event_type)) {
      return NextResponse.json(
        { error: `Invalid event_type. Must be one of: ${validEvents.join(", ")}` },
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

    // 2. Fetch current attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts")
      .select("id, student_id, proctor_log, status")
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

    // 3. Append to proctor_log json array
    const existingLog = Array.isArray(attempt.proctor_log)
      ? (attempt.proctor_log as Array<Record<string, unknown>>)
      : [];

    const newEntry = {
      event_type,
      timestamp: timestamp || new Date().toISOString(),
      details: details ?? null,
    };

    const updatedLog = [...existingLog, newEntry];

    const { error: updateError } = await supabase
      .from("exam_attempts")
      .update({
        proctor_log: updatedLog as unknown as Json,
      })
      .eq("id", attempt_id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update proctoring log: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      logged_event: newEntry,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
