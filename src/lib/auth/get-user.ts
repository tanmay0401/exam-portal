import { createClient } from "@/lib/supabase/server";
import { getPrivilegedSupabaseClient } from "@/lib/supabase/admin";
import { getCandidateSession } from "./candidate-session";

import { headers } from "next/headers";

export interface AuthenticatedUser {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "student";
}

/**
 * Resolves the currently authenticated user across both Supabase Auth sessions
 * and signed Candidate Sessions.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  // 1. Check Supabase Auth first
  try {
    const supabase = await createClient();
    let bearerToken: string | undefined;
    try {
      const reqHeaders = await headers();
      const authHeader = reqHeaders.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        bearerToken = authHeader.slice(7).trim();
      }
    } catch {
      // In environments where headers() is not available
    }

    const {
      data: { user },
    } = await supabase.auth.getUser(bearerToken);

    if (user) {
      const privileged = await getPrivilegedSupabaseClient();
      const { data: profile } = await privileged
        .from("profiles")
        .select("id, role, full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      return {
        id: user.id,
        email: user.email || profile?.email || "",
        full_name:
          profile?.full_name ||
          (user.user_metadata?.full_name as string) ||
          "User",
        role: (profile?.role as "admin" | "student") || "student",
      };
    }
  } catch {
    // Ignore error and fall back to candidate session
  }

  // 2. Check Candidate Session cookie
  try {
    const candidate = await getCandidateSession();
    if (candidate) {
      return {
        id: candidate.id,
        email: candidate.email,
        full_name: candidate.full_name,
        role: "student",
      };
    }
  } catch {
    // Ignore error
  }

  return null;
}
