import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-admin";

interface RouteParams {
  params: Promise<{ id: string; batchId: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams
) {
  const { errorResponse, supabase } = await authenticateAdmin();
  if (errorResponse) return errorResponse;

  const { id, batchId } = await params;
  if (!id || !batchId) {
    return NextResponse.json({ error: "Missing exam ID or batch ID" }, { status: 400 });
  }

  // Fetch batch details and verify it belongs to this exam
  const { data: batch, error: batchError } = await supabase
    .from("exam_batches")
    .select(`
      id,
      batch_number,
      exam_id,
      created_at
    `)
    .eq("id", batchId)
    .eq("exam_id", id)
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: "Batch not found for this exam." }, { status: 404 });
  }

  // Fetch exam details separately to avoid PostgREST relationship ambiguity
  const { data: examData } = await supabase
    .from("exams")
    .select(`
      id,
      title,
      status,
      duration_minutes,
      marks_per_question,
      negative_marks,
      total_questions,
      subjects (
        name
      )
    `)
    .eq("id", id)
    .single();

  const batchWithExam = {
    ...batch,
    exams: examData || null,
  };

  // Fetch batch questions with question details
  const { data: batchQuestions, error: questionsError } = await supabase
    .from("exam_batch_questions")
    .select(`
      id,
      question_order,
      questions (
        id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        difficulty
      )
    `)
    .eq("batch_id", batchId)
    .order("question_order", { ascending: true });

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  return NextResponse.json({
    batch,
    questions: batchQuestions || [],
  });
}
