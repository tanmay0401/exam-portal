import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
      supabase,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      ),
      user: null,
      supabase,
    };
  }

  return { error: null, user, supabase };
}
