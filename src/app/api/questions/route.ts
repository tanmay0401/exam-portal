import { authenticateAdmin } from "@/lib/auth-admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { CorrectOption, QuestionDifficulty } from "@/lib/types/database";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const subjectId = searchParams.get("subject_id");

    let query = supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });

    if (subjectId) {
      query = query.eq("subject_id", subjectId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      questions: data || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { errorResponse, user, supabase } = await authenticateAdmin();
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const {
      subject_id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      difficulty = "medium",
    } = body;

    if (!subject_id) {
      return NextResponse.json(
        { error: "Subject ID is required" },
        { status: 400 }
      );
    }

    if (!question_text || !question_text.trim()) {
      return NextResponse.json(
        { error: "Question text is required" },
        { status: 400 }
      );
    }

    if (
      !option_a ||
      !option_a.trim() ||
      !option_b ||
      !option_b.trim() ||
      !option_c ||
      !option_c.trim() ||
      !option_d ||
      !option_d.trim()
    ) {
      return NextResponse.json(
        { error: "All four options (A, B, C, D) are required" },
        { status: 400 }
      );
    }

    const validOptions: CorrectOption[] = ["A", "B", "C", "D"];
    if (!validOptions.includes(correct_option)) {
      return NextResponse.json(
        { error: "Correct option must be one of: A, B, C, D" },
        { status: 400 }
      );
    }

    const validDifficulties: QuestionDifficulty[] = ["easy", "medium", "hard"];
    if (difficulty && !validDifficulties.includes(difficulty)) {
      return NextResponse.json(
        { error: "Difficulty must be one of: easy, medium, hard" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("questions")
      .insert({
        subject_id,
        question_text: question_text.trim(),
        option_a: option_a.trim(),
        option_b: option_b.trim(),
        option_c: option_c.trim(),
        option_d: option_d.trim(),
        correct_option,
        difficulty: (difficulty as QuestionDifficulty) || "medium",
        created_by: user!.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        question: data,
        ...data,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
