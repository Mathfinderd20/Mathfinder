export const APP_ENVIRONMENTS = [
  "development",
  "staging",
  "production",
] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

const PRODUCTION_SUPABASE_HOSTNAMES = new Set([
  "guronltdufvmnwnjqggd.supabase.co",
  "auth.diresheets.com",
]);

export function readAppEnvironment(value: unknown): AppEnvironment {
  if (
    typeof value === "string" &&
    APP_ENVIRONMENTS.includes(value as AppEnvironment)
  )
    return value as AppEnvironment;
  throw new Error(
    `VITE_APP_ENV must be one of: ${APP_ENVIRONMENTS.join(", ")}`,
  );
}

function isServiceRoleKey(value: string) {
  if (value.startsWith("sb_secret_")) return true;
  const payload = value.split(".")[1];
  if (!payload) return false;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)).role === "service_role";
  } catch {
    return false;
  }
}

export function validateWebBuildEnvironment(
  environment: Record<string, string | undefined>,
) {
  const appEnvironment = readAppEnvironment(environment.VITE_APP_ENV);
  const supabaseUrl = environment.VITE_SUPABASE_URL?.trim();
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL is required");
  if (!publishableKey)
    throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is required");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("VITE_SUPABASE_URL must be a valid URL");
  }
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(
    parsedUrl.hostname,
  );
  if (
    parsedUrl.protocol !== "https:" &&
    !(appEnvironment === "development" && isLocal)
  )
    throw new Error("Hosted Supabase URLs must use HTTPS");
  if (
    appEnvironment === "staging" &&
    PRODUCTION_SUPABASE_HOSTNAMES.has(parsedUrl.hostname)
  )
    throw new Error("Staging must not target the production Supabase project");
  if (isServiceRoleKey(publishableKey))
    throw new Error(
      "A Supabase service-role key must never enter a browser build",
    );

  return { appEnvironment, supabaseUrl, publishableKey };
}
