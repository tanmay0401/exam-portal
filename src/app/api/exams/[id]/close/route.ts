import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  { params }: RouteParams
) {
  const { errorResponse, supabase } = await authenticateAdmin();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing exam ID" }, { status: 400 });
  }

  try {
    const { data: updatedExam, error: updateError } = await supabase
      .from("exams")
      .update({
        status: "closed",
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
        { error: updateError?.message || "Failed to close exam." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Exam closed successfully.",
      exam: updatedExam,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to close exam.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
