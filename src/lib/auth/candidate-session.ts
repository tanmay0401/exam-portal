import { cookies } from "next/headers";
import crypto from "crypto";

export interface CandidateSession {
  id: string;
  email: string;
  full_name: string;
  role: "student";
  timestamp: number;
}

const SESSION_COOKIE_NAME = "candidate_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

function getSecretKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "candidate_session_auth_secret_token_2026"
  );
}

export function createCandidateToken(payload: Omit<CandidateSession, "timestamp">): string {
  const session: CandidateSession = {
    ...payload,
    timestamp: Date.now(),
  };

  const data = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSecretKey())
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
}

export function verifyCandidateToken(token: string): CandidateSession | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [data, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", getSecretKey())
      .update(data)
      .digest("base64url");

    if (signature !== expectedSig) {
      return null;
    }

    const jsonStr = Buffer.from(data, "base64url").toString("utf8");
    const session: CandidateSession = JSON.parse(jsonStr);

    // Check expiry (7 days)
    const now = Date.now();
    if (now - session.timestamp > SESSION_MAX_AGE * 1000) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getCandidateSession(): Promise<CandidateSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyCandidateToken(token);
}

export async function setCandidateSessionCookie(
  payload: Omit<CandidateSession, "timestamp">
): Promise<void> {
  const token = createCandidateToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearCandidateSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
