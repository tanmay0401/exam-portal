import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-admin";
import Papa from "papaparse";
import { CorrectOption, QuestionDifficulty } from "@/lib/types/database";

export async function POST(request: Request) {
  try {
    const { errorResponse, user, supabase } = await authenticateAdmin();
    if (errorResponse) return errorResponse;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const subjectId = formData.get("subject_id") as string | null;

    if (!subjectId) {
      return NextResponse.json(
        { error: "Subject ID is required" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "CSV file is required" },
        { status: 400 }
      );
    }

    const fileContent = await file.text();

    const parsed = Papa.parse<Record<string, string>>(fileContent, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) =>
        header.trim().toLowerCase().replace(/\s+/g, "_"),
    });

    if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json(
        { error: "Failed to parse CSV file", details: parsed.errors },
        { status: 400 }
      );
    }

    const validQuestions: Array<{
      subject_id: string;
      question_text: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_option: CorrectOption;
      difficulty: QuestionDifficulty;
      created_by: string;
    }> = [];

    let skippedCount = 0;
    const rowErrors: string[] = [];

    const validOptions: CorrectOption[] = ["A", "B", "C", "D"];
    const validDifficulties: QuestionDifficulty[] = ["easy", "medium", "hard"];

    parsed.data.forEach((row, index) => {
      const rowNum = index + 2; // accounting for 1-based index and header row
      const qText = row.question_text?.trim();
      const optA = row.option_a?.trim();
      const optB = row.option_b?.trim();
      const optC = row.option_c?.trim();
      const optD = row.option_d?.trim();
      const rawCorrect = row.correct_option?.trim().toUpperCase();
      const correctOpt = rawCorrect as CorrectOption;
      let diff = row.difficulty?.trim().toLowerCase() as QuestionDifficulty;

      if (!qText) {
        skippedCount++;
        rowErrors.push(`Row ${rowNum}: Missing question_text`);
        return;
      }

      if (!optA || !optB || !optC || !optD) {
        skippedCount++;
        rowErrors.push(
          `Row ${rowNum}: All options (option_a, option_b, option_c, option_d) must be filled`
        );
        return;
      }

      if (!validOptions.includes(correctOpt)) {
        skippedCount++;
        rowErrors.push(
          `Row ${rowNum}: Invalid correct_option '${row.correct_option}'. Expected A, B, C, or D`
        );
        return;
      }

      if (!diff || !validDifficulties.includes(diff)) {
        diff = "medium";
      }

      validQuestions.push({
        subject_id: subjectId,
        question_text: qText,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_option: correctOpt,
        difficulty: diff,
        created_by: user!.id,
      });
    });

    if (validQuestions.length > 0) {
      const { error: insertError } = await supabase
        .from("questions")
        .insert(validQuestions);

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      imported: validQuestions.length,
      skipped: skippedCount,
      total: parsed.data.length,
      errors: rowErrors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
