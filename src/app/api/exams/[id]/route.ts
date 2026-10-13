import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams
) {
  const { errorResponse, supabase } = await authenticateAdmin();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing exam ID" }, { status: 400 });
  }

  // Fetch exam with subject
  const { data: exam, error } = await supabase
    .from("exams")
    .select(`
      *,
      subjects (
        id,
        name,
        description
      )
    `)
    .eq("id", id)
    .single();

  if (error || !exam) {
    return NextResponse.json(
      { error: error?.message || "Exam not found." },
      { status: 404 }
    );
  }

  // Fetch batches for this exam separately to avoid PostgREST circular foreign key ambiguity
  const { data: batches } = await supabase
    .from("exam_batches")
    .select(`
      id,
      batch_number,
      created_at,
      exam_batch_questions (
        count
      )
    `)
    .eq("exam_id", id)
    .order("batch_number", { ascending: true });

  const examWithBatches = {
    ...exam,
    exam_batches: batches || [],
  };

  return NextResponse.json({
    exam: examWithBatches,
    batches: batches || [],
  });
}

export async function PUT(
  request: Request,
  { params }: RouteParams
) {
  const { errorResponse, supabase } = await authenticateAdmin();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing exam ID" }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Check if exam exists
    const { data: existingExam, error: fetchError } = await supabase
      .from("exams")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingExam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return NextResponse.json({ error: "Exam title cannot be empty." }, { status: 400 });
      }
      updates.title = body.title.trim();
    }

    if (body.subject_id !== undefined) {
      updates.subject_id = body.subject_id;
    }

    if (body.total_questions !== undefined) {
      const tq = Number(body.total_questions);
      if (isNaN(tq) || tq <= 0) {
        return NextResponse.json({ error: "Total questions must be positive." }, { status: 400 });
      }

      // Check subject questions bank
      const targetSubjectId = body.subject_id || existingExam.subject_id;
      if (targetSubjectId) {
        const { count, error: countErr } = await supabase
          .from("questions")
          .select("*", { count: "exact", head: true })
          .eq("subject_id", targetSubjectId);

        if (!countErr && (count ?? 0) < tq) {
          return NextResponse.json(
            { error: `Selected subject only has ${count ?? 0} questions, which is less than ${tq}.` },
            { status: 400 }
          );
        }
      }
      updates.total_questions = tq;
    }

    if (body.marks_per_question !== undefined) {
      updates.marks_per_question = Number(body.marks_per_question);
    }

    if (body.negative_marks !== undefined) {
      updates.negative_marks = Number(body.negative_marks);
    }

    if (body.duration_minutes !== undefined) {
      const dur = Number(body.duration_minutes);
      if (isNaN(dur) || dur <= 0) {
        return NextResponse.json({ error: "Duration must be positive." }, { status: 400 });
      }
      updates.duration_minutes = dur;
    }

    if (body.batch_count !== undefined) {
      const bc = Number(body.batch_count);
      if (isNaN(bc) || bc < 1) {
        return NextResponse.json({ error: "Batch count must be at least 1." }, { status: 400 });
      }
      updates.batch_count = bc;
    }

    if (body.allow_question_reuse !== undefined) {
      updates.allow_question_reuse = Boolean(body.allow_question_reuse);
    }

    if (body.is_dry_run !== undefined) {
      updates.is_dry_run = Boolean(body.is_dry_run);
    }

    if (body.starts_at !== undefined) {
      updates.starts_at = body.starts_at ? new Date(body.starts_at).toISOString() : null;
    }

    if (body.ends_at !== undefined) {
      updates.ends_at = body.ends_at ? new Date(body.ends_at).toISOString() : null;
    }

    if (body.status !== undefined) {
      updates.status = body.status;
    }

    if (body.selected_batch_id !== undefined) {
      updates.selected_batch_id = body.selected_batch_id;
    }

    const { data: updatedExam, error: updateError } = await supabase
      .from("exams")
      .update(updates as any)
      .eq("id", id)
      .select(`
        *,
        subjects (
          id,
          name
        )
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ exam: updatedExam });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteParams
) {
  const { errorResponse, supabase } = await authenticateAdmin();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing exam ID" }, { status: 400 });
  }

  // Get batches to safely cascade delete questions if necessary
  const { data: batches } = await supabase
    .from("exam_batches")
    .select("id")
    .eq("exam_id", id);

  if (batches && batches.length > 0) {
    const batchIds = batches.map((b) => b.id);
    await supabase
      .from("exam_batch_questions")
      .delete()
      .in("batch_id", batchIds);

    await supabase
      .from("exam_batches")
      .delete()
      .eq("exam_id", id);
  }

  const { error: deleteError } = await supabase
    .from("exams")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Exam deleted successfully" });
}
