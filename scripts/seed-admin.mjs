// Quick script to create or promote an admin user using the Supabase Service Role Key
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env.local if present
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["'](.*)["']$/, "$1");
      process.env[key] = val;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey || supabaseUrl.includes("placeholder")) {
  console.error("❌ Please configure real Supabase credentials in .env.local first:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co");
  console.error("   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>\n");
  console.error("Alternatively, run the SQL script in supabase/seed.sql directly in the Supabase SQL Editor!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const adminEmail = process.argv[2] || "admin@examportal.com";
const adminPassword = process.argv[3] || "AdminPassword@123";

async function createAdmin() {
  console.log(`Creating/Verifying admin user: ${adminEmail}...`);

  // 1. Try to create user
  const { data: user, error: createError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: "Exam Administrator", role: "admin" },
  });

  let userId = user?.user?.id;

  if (createError) {
    if (createError.message.includes("already been registered")) {
      console.log("User already exists in auth.users. Looking up UID...");
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const existing = usersData?.users?.find((u) => u.email === adminEmail);
      if (existing) {
        userId = existing.id;
      }
    } else {
      console.error("Error creating auth user:", createError.message);
      process.exit(1);
    }
  }

  if (!userId) {
    console.error("Could not determine user ID.");
    process.exit(1);
  }

  // 2. Ensure profile exists and has role='admin'
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      email: adminEmail,
      full_name: "Exam Administrator",
      role: "admin",
    });

  if (profileError) {
    console.error("Error setting admin role in profiles table:", profileError.message);
  } else {
    console.log("\n==================================================");
    console.log("   ADMIN ACCOUNT READY! ✓");
    console.log("==================================================");
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log("==================================================\n");
  }
}

createAdmin();
