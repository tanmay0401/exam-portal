import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { errorResponse, supabase } = await authenticateAdmin();
    if (errorResponse) return errorResponse;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Missing subject ID" }, { status: 400 });
    }

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
      .update({
        name: name.trim(),
        description: description?.trim() || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      subject: data,
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
      return NextResponse.json({ error: "Missing subject ID" }, { status: 400 });
    }

    const { error } = await supabase.from("subjects").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Subject deleted successfully",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
