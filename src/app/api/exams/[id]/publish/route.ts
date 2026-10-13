import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-admin";
import { getAppBaseUrl } from "@/lib/utils";
import crypto from "crypto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
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
    const batch_id = body.batch_id || body.selected_batch_id;

    if (!batch_id) {
      return NextResponse.json(
        { error: "A batch must be selected to publish this exam." },
        { status: 400 }
      );
    }

    // 1. Verify batch exists and belongs to this exam
    const { data: batch, error: batchError } = await supabase
      .from("exam_batches")
      .select("id, batch_number")
      .eq("id", batch_id)
      .eq("exam_id", id)
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: "Selected batch is invalid or does not belong to this exam." },
        { status: 400 }
      );
    }

    // 2. Generate secure token
    const token = crypto.randomUUID().replace(/-/g, "");
    const publishedAt = new Date().toISOString();

    // 3. Update exam record
    const { data: updatedExam, error: updateError } = await supabase
      .from("exams")
      .update({
        status: "published",
        selected_batch_id: batch_id,
        exam_link_token: token,
        published_at: publishedAt,
      })
      .eq("id", id)
      .select(`
        *,
        subjects (
          id,
          name
        )
      `)
      .single();

    if (updateError || !updatedExam) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to publish exam." },
        { status: 500 }
      );
    }

    const baseUrl = getAppBaseUrl();
    const shareableUrl = `${baseUrl}/exam/${token}`;

    return NextResponse.json({
      message: "Exam successfully published.",
      exam: updatedExam,
      token,
      exam_link_token: token,
      exam_link: `/exam/${token}`,
      shareable_url: shareableUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to publish exam.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
