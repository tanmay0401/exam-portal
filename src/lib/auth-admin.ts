import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function authenticateAdmin() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        errorResponse: NextResponse.json(
          { error: "Unauthorized. Please log in." },
          { status: 401 }
        ),
        user: null,
        supabase,
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return {
        errorResponse: NextResponse.json(
          { error: "Forbidden. Admin privileges required." },
          { status: 403 }
        ),
        user,
        supabase,
      };
    }

    return {
      errorResponse: null,
      user,
      profile,
      supabase,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication error";
    return {
      errorResponse: NextResponse.json({ error: message }, { status: 500 }),
      user: null,
      supabase: null as unknown as Awaited<ReturnType<typeof createClient>>,
    };
  }
}
