import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: subjects, error } = await supabase
      .from("subjects")
      .select(`
        id,
        name,
        description,
        created_by,
        created_at,
        questions(count)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formatted = (subjects || []).map((sub: any) => ({
      id: sub.id,
      name: sub.name,
      description: sub.description,
      created_by: sub.created_by,
      created_at: sub.created_at,
      question_count: sub.questions?.[0]?.count ?? 0,
    }));

    return NextResponse.json({
      subjects: formatted,
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
    const { name, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Subject name is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("subjects")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        created_by: user!.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        subject: data,
        ...data,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
