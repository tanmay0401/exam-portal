import { NextRequest, NextResponse } from "next/server";
import { getPrivilegedSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { Json } from "@/lib/types/database";
import crypto from "crypto";

export interface ProctorLogRecord {
  id: string;
  attempt_id: string;
  student_id: string;
  exam_id?: string;
  event_type: string;
  timestamp: string;
  severity: "alert" | "warning" | "info";
  details?: Record<string, unknown> | null;
}

const VALID_EVENTS = new Set([
  "tab_hidden",
  "tab_visible",
  "fullscreen_exit",
  "fullscreen_enter",
  "face_not_detected",
  "face_detected",
  "multiple_faces_detected",
  "background_person_detected",
  "head_turned_away",
  "looking_down",
  "gaze_away",
  "camera_disconnected",
  "camera_restored",
  "audio_disturbance",
]);

function inferSeverity(eventType: string): "alert" | "warning" | "info" {
  switch (eventType) {
    case "multiple_faces_detected":
    case "background_person_detected":
    case "fullscreen_exit":
    case "camera_disconnected":
      return "alert";
    case "tab_hidden":
    case "face_not_detected":
    case "head_turned_away":
    case "looking_down":
    case "audio_disturbance":
      return "warning";
    default:
      return "info";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attempt_id, event_type, timestamp, severity, details, events } = body;

    if (!attempt_id) {
      return NextResponse.json(
        { error: "attempt_id is required" },
        { status: 400 }
      );
    }

    // 1. Authenticate candidate / user (supports Supabase Auth & candidate_session cookie)
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to record proctoring events" },
        { status: 401 }
      );
    }

    // 2. Fetch target attempt securely using elevated client
    const privilegedClient = await getPrivilegedSupabaseClient();
    const { data: attempt, error: attemptError } = await privilegedClient
      .from("exam_attempts")
      .select("id, student_id, exam_id, proctor_log, status")
      .eq("id", attempt_id)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    // 3. Verify attempt ownership
    if (attempt.student_id !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized access to this attempt" },
        { status: 403 }
      );
    }

    // 4. Normalize incoming events (support single event payload or batch array)
    const incomingRawEvents: Array<{
      id?: string;
      event_type: string;
      timestamp?: string;
      severity?: "alert" | "warning" | "info";
      details?: Record<string, unknown> | null;
    }> = [];

    if (Array.isArray(events) && events.length > 0) {
      for (const ev of events) {
        if (ev && typeof ev.event_type === "string" && VALID_EVENTS.has(ev.event_type)) {
          incomingRawEvents.push(ev);
        }
      }
    } else if (event_type && typeof event_type === "string") {
      if (!VALID_EVENTS.has(event_type)) {
        return NextResponse.json(
          {
            error: `Invalid event_type "${event_type}". Must be one of: ${Array.from(VALID_EVENTS).join(", ")}`,
          },
          { status: 400 }
        );
      }
      incomingRawEvents.push({
        id: body.id,
        event_type,
        timestamp,
        severity,
        details,
      });
    } else {
      return NextResponse.json(
        { error: "event_type or non-empty events array required" },
        { status: 400 }
      );
    }

    if (incomingRawEvents.length === 0) {
      return NextResponse.json(
        { error: "No valid events to record" },
        { status: 400 }
      );
    }

    // 5. Existing log in database
    const existingLog: ProctorLogRecord[] = Array.isArray(attempt.proctor_log)
      ? (attempt.proctor_log as unknown as ProctorLogRecord[])
      : [];

    const existingIds = new Set(existingLog.map((e) => e.id).filter(Boolean));

    // 6. Deduplicate and format each event
    const newRecords: ProctorLogRecord[] = [];
    for (const raw of incomingRawEvents) {
      const eventId = raw.id || crypto.randomUUID();
      if (existingIds.has(eventId)) {
        // Skip duplicate ID
        continue;
      }

      const eventTime = raw.timestamp || new Date().toISOString();
      const eventSev = raw.severity || inferSeverity(raw.event_type);

      // Check if an identical event occurred within 1000ms
      const isDuplicateRecent = existingLog.some((e) => {
        if (e.event_type !== raw.event_type) return false;
        const diffMs = Math.abs(new Date(e.timestamp).getTime() - new Date(eventTime).getTime());
        return diffMs < 1000;
      });

      if (isDuplicateRecent) {
        continue;
      }

      existingIds.add(eventId);
      newRecords.push({
        id: eventId,
        attempt_id: attempt.id,
        student_id: attempt.student_id,
        exam_id: attempt.exam_id,
        event_type: raw.event_type,
        timestamp: eventTime,
        severity: eventSev,
        details: raw.details ?? null,
      });
    }

    // If all were duplicates, return gracefully
    if (newRecords.length === 0) {
      return NextResponse.json({
        success: true,
        saved_count: 0,
        total_events: existingLog.length,
        message: "Events already recorded (deduplicated).",
      });
    }

    const updatedLog = [...existingLog, ...newRecords];

    // 7. Persist updated log to exam_attempts
    const { error: updateError } = await privilegedClient
      .from("exam_attempts")
      .update({
        proctor_log: updatedLog as unknown as Json,
      })
      .eq("id", attempt_id);

    if (updateError) {
      console.error("Database update error writing proctor_log:", updateError);
      return NextResponse.json(
        { error: "Failed to update proctoring log: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      saved_count: newRecords.length,
      total_events: updatedLog.length,
      logged_events: newRecords,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Proctor logging exception:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
