import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
    // 1. Fetch exam configuration
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("*")
      .eq("id", id)
      .single();

    if (examError || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    if (!exam.subject_id) {
      return NextResponse.json(
        { error: "Cannot generate batches: Exam does not have an assigned subject." },
        { status: 400 }
      );
    }

    // 2. Fetch all questions for the subject
    const { data: questionPool, error: poolError } = await supabase
      .from("questions")
      .select("id")
      .eq("subject_id", exam.subject_id);

    if (poolError) {
      return NextResponse.json({ error: poolError.message }, { status: 500 });
    }

    if (!questionPool || questionPool.length < exam.total_questions) {
      return NextResponse.json(
        {
          error: `Subject question pool has only ${questionPool?.length ?? 0} question(s). ${exam.total_questions} question(s) required per batch.`,
        },
        { status: 400 }
      );
    }

    // 3. Delete existing batches & questions for this exam (regeneration)
    const { data: existingBatches } = await supabase
      .from("exam_batches")
      .select("id")
      .eq("exam_id", id);

    if (existingBatches && existingBatches.length > 0) {
      const existingBatchIds = existingBatches.map((b) => b.id);
      await supabase
        .from("exam_batch_questions")
        .delete()
        .in("batch_id", existingBatchIds);

      await supabase
        .from("exam_batches")
        .delete()
        .eq("exam_id", id);
    }

    // Reset selected_batch_id if it was set
    await supabase
      .from("exams")
      .update({ selected_batch_id: null })
      .eq("id", id);

    // 4. Generate batches
    const batchCount = exam.batch_count || 1;
    const totalQuestions = exam.total_questions;
    const allowReuse = exam.allow_question_reuse;
    const poolIds = questionPool.map((q) => q.id);

    // If allowReuse is false and pool has enough questions for strictly disjoint sets
    const canPartitionStrictly =
      !allowReuse && poolIds.length >= batchCount * totalQuestions;

    let shuffledPool = shuffleArray(poolIds);

    const generatedBatches = [];

    for (let batchNum = 1; batchNum <= batchCount; batchNum++) {
      // 4a. Create the batch record
      const { data: createdBatch, error: batchInsertError } = await supabase
        .from("exam_batches")
        .insert({
          exam_id: id,
          batch_number: batchNum,
        })
        .select()
        .single();

      if (batchInsertError || !createdBatch) {
        throw new Error(
          `Failed to create batch ${batchNum}: ${batchInsertError?.message || "Unknown error"}`
        );
      }

      let selectedQuestionIds: string[] = [];

      if (canPartitionStrictly) {
        // Disjoint slice for each batch
        const start = (batchNum - 1) * totalQuestions;
        selectedQuestionIds = shuffledPool.slice(start, start + totalQuestions);
      } else {
        // Sample totalQuestions without duplicates within this batch
        const batchPool = shuffleArray(poolIds);
        selectedQuestionIds = batchPool.slice(0, totalQuestions);
      }

      // Randomize the order of questions in the batch paper
      const randomizedOrder = shuffleArray(selectedQuestionIds);

      // Prepare batch questions
      const batchQuestionsToInsert = randomizedOrder.map((qId, index) => ({
        batch_id: createdBatch.id,
        question_id: qId,
        question_order: index + 1,
      }));

      const { error: questionsInsertError } = await supabase
        .from("exam_batch_questions")
        .insert(batchQuestionsToInsert);

      if (questionsInsertError) {
        throw new Error(
          `Failed to insert questions for batch ${batchNum}: ${questionsInsertError.message}`
        );
      }

      generatedBatches.push({
        ...createdBatch,
        question_count: batchQuestionsToInsert.length,
      });
    }

    return NextResponse.json({
      message: `Successfully generated ${generatedBatches.length} batches.`,
      batches: generatedBatches,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Batch generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
