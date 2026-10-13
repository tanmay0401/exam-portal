import { NextRequest, NextResponse } from "next/server";
import { getPrivilegedSupabaseClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = "login", email, password, full_name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email address and password are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const privilegedClient = await getPrivilegedSupabaseClient();

    if (action === "register") {
      // 1. Check if user already exists in profiles
      const { data: existingProfile } = await privilegedClient
        .from("profiles")
        .select("id, role, full_name")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (existingProfile) {
        return NextResponse.json(
          {
            error:
              "An account with this email already exists. Please sign in with your password.",
          },
          { status: 409 }
        );
      }

      // 2. Create user with confirmed email via admin API
      let newUserId: string | null = null;
      try {
        const { data: created, error: createError } =
          await privilegedClient.auth.admin.createUser({
            email: cleanEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
              full_name: full_name?.trim() || cleanEmail.split("@")[0],
              role: "student",
            },
          });

        if (createError) {
          throw createError;
        }
        newUserId = created?.user?.id ?? null;
      } catch (adminErr: unknown) {
        // Fallback: regular sign up if admin.createUser is restricted
        console.warn("Notice: admin.createUser fallback to client signUp:", adminErr);
        const { data: signUpData, error: signUpError } =
          await privilegedClient.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
              data: {
                full_name: full_name?.trim() || cleanEmail.split("@")[0],
                role: "student",
              },
            },
          });

        if (signUpError) {
          return NextResponse.json(
            { error: signUpError.message },
            { status: 400 }
          );
        }
        newUserId = signUpData.user?.id ?? null;
      }

      if (newUserId) {
        // Ensure profile is recorded in public.profiles table
        await privilegedClient.from("profiles").upsert({
          id: newUserId,
          email: cleanEmail,
          full_name: full_name?.trim() || cleanEmail.split("@")[0],
          role: "student",
        });
      }
    }

    // Sign in the user using the SSR server client to establish session cookies
    const supabase = await createClient();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error:
            authError?.message ||
            "Authentication failed. Please verify your candidate credentials.",
        },
        { status: 401 }
      );
    }

    // Verify candidate role
    const { data: profile } = await privilegedClient
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("id", authData.user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      message: "Candidate authenticated successfully.",
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: profile?.full_name || authData.user.user_metadata?.full_name || "Candidate",
        role: profile?.role || "student",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal authentication error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
