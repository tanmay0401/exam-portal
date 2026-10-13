export { cn } from "cn";

/**
 * Returns the resolved canonical base URL for the application.
 * Prioritizes:
 * 1. NEXT_PUBLIC_APP_URL (if configured and not plain localhost in production)
 * 2. Vercel deployment URLs (VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL)
 * 3. Browser origin (window.location.origin)
 * 4. Fallback to http://localhost:3000
 */
export function getAppBaseUrl(): string {
  // Check explicit public app URL if defined and not localhost
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (publicUrl && !publicUrl.includes("localhost")) {
    return publicUrl.replace(/\/$/, "");
  }

  // Check Vercel production deployment URLs
  const vercelProjectProdUrl =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProjectProdUrl) {
    return `https://${vercelProjectProdUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  const vercelUrl =
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  // If in browser, use current window location origin
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  // If public app URL was set (even localhost in dev)
  if (publicUrl) {
    return publicUrl.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
