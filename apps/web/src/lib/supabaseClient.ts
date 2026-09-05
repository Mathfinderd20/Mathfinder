import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

const authStorageKey = (url: string) => `mathfinder:auth:${url}`;
export function clearStoredSession() {
  const config = readSupabaseConfig(import.meta.env);
  if (!config) return;
  window.localStorage.removeItem(authStorageKey(config.url));
  window.localStorage.removeItem(`${authStorageKey(config.url)}-code-verifier`);
}
// Offline identity is only a cache selector. Server authorization always uses
// getUser + RLS. Expired sessions can view a saved copy for at most seven days.
export function storedOfflineUser(): User | undefined {
  try {
    const config = readSupabaseConfig(import.meta.env);
    if (!config) return undefined;
    const raw = window.localStorage.getItem(authStorageKey(config.url));
    const session = raw ? JSON.parse(raw) : undefined;
    if (
      !session?.user?.id ||
      session.user.is_anonymous !== false ||
      typeof session.expires_at !== "number" ||
      session.expires_at * 1000 + 7 * 86400000 < Date.now()
    )
      return undefined;
    return session.user as User;
  } catch {
    return undefined;
  }
}

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
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              signal: init?.signal
                ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)])
                : AbortSignal.timeout(10000),
            }),
        },
        auth: {
          storageKey: authStorageKey(config.url),
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
