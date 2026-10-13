import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types/database";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables"
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Returns an elevated server-side Supabase client.
 * In production on Vercel, uses the secret SUPABASE_SERVICE_ROLE_KEY directly to bypass RLS.
 * In local/dev environments where service_role key is omitted or equals the anon key,
 * authenticates as the verified administrator to grant privileged RLS bypass.
 */
export async function getPrivilegedSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in environment variables");
  }

  const isRealServiceKey =
    serviceRoleKey &&
    !serviceRoleKey.startsWith("sb_publishable_") &&
    serviceRoleKey.length > 50;

  if (isRealServiceKey) {
    return createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  const fallbackKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    serviceRoleKey;

  if (!fallbackKey) {
    throw new Error("Missing Supabase API keys");
  }

  const client = createClient<Database>(supabaseUrl, fallbackKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Authenticate as system admin for elevated access
  try {
    await client.auth.signInWithPassword({
      email: "admin@examportal.com",
      password: "AdminPassword@123",
    });
  } catch (err) {
    console.warn("Notice: privileged client fallback sign-in failed:", err);
  }

  return client;
}
