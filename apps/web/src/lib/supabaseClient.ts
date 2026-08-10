import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export function readSupabaseConfig(
  environment: Record<string, string | boolean | undefined>,
): SupabasePublicConfig | undefined {
  const url = environment.VITE_SUPABASE_URL;
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== "string" || typeof publishableKey !== "string") {
    return undefined;
  }
  const normalizedUrl = url.trim();
  const normalizedKey = publishableKey.trim();
  if (!normalizedUrl || !normalizedKey) return undefined;
  try {
    const parsed = new URL(normalizedUrl);
    const isLoopback =
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "[::1]";
    const isSecureRemote = parsed.protocol === "https:";
    const isLocalDevelopment = isLoopback && parsed.protocol === "http:";
    if (!isSecureRemote && !isLocalDevelopment) return undefined;
  } catch {
    return undefined;
  }
  return { url: normalizedUrl, publishableKey: normalizedKey };
}

export function createOptionalSupabaseClient(
  environment: Record<string, string | boolean | undefined> = import.meta.env,
): SupabaseClient | undefined {
  const config = readSupabaseConfig(environment);
  return config
    ? createClient(config.url, config.publishableKey, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : undefined;
}

export const supabase = createOptionalSupabaseClient();
export const cloudBackendAvailable = !!supabase;
