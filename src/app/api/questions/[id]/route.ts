import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-admin";
import { CorrectOption, QuestionDifficulty } from "@/lib/types/database";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { errorResponse, supabase } = await authenticateAdmin();
    if (errorResponse) return errorResponse;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing question ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      difficulty,
      subject_id,
    } = body;

    const updateData: Record<string, any> = {};

    if (question_text !== undefined) {
      if (!question_text.trim()) {
        return NextResponse.json(
          { error: "Question text cannot be empty" },
          { status: 400 }
        );
      }
      updateData.question_text = question_text.trim();
    }

    if (option_a !== undefined) updateData.option_a = option_a.trim();
    if (option_b !== undefined) updateData.option_b = option_b.trim();
    if (option_c !== undefined) updateData.option_c = option_c.trim();
    if (option_d !== undefined) updateData.option_d = option_d.trim();

    if (correct_option !== undefined) {
      const validOptions: CorrectOption[] = ["A", "B", "C", "D"];
      if (!validOptions.includes(correct_option)) {
        return NextResponse.json(
          { error: "Correct option must be one of: A, B, C, D" },
          { status: 400 }
        );
      }
      updateData.correct_option = correct_option;
    }

    if (difficulty !== undefined) {
      const validDifficulties: QuestionDifficulty[] = ["easy", "medium", "hard"];
      if (!validDifficulties.includes(difficulty)) {
        return NextResponse.json(
          { error: "Difficulty must be one of: easy, medium, hard" },
          { status: 400 }
        );
      }
      updateData.difficulty = difficulty;
    }

    if (subject_id !== undefined) {
      updateData.subject_id = subject_id;
    }

    const { data, error } = await supabase
      .from("questions")
      .update(updateData as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      question: data,
      ...data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { errorResponse, supabase } = await authenticateAdmin();
    if (errorResponse) return errorResponse;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing question ID" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("questions").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
