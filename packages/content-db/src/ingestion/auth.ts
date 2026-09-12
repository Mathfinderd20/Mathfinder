import { STAGING_PROJECT } from "./model";

export interface ServerConfig {
  supabaseUrl: string;
  publishableKey: string;
  origin: string;
  permissionReviewId: string;
  targetVerificationId: string;
}
export function permittedOrigin(request: Request, origin: string): boolean {
  const supplied = request.headers.get("origin");
  if (supplied !== null) return supplied === origin;
  // Browsers omit Origin on same-origin GETs. Fetch Metadata still proves the
  // browser context; bearer authorization is independently verified afterward.
  return (
    request.method === "GET" &&
    new URL(request.url).origin === origin &&
    request.headers.get("sec-fetch-site") === "same-origin"
  );
}
export function validateServerConfig(config: ServerConfig) {
  const url = new URL(config.supabaseUrl);
  if (
    url.origin !== `https://${STAGING_PROJECT}.supabase.co` ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Only the documented staging Supabase target is permitted");
  if (
    !config.publishableKey ||
    !config.permissionReviewId ||
    !config.targetVerificationId
  )
    throw new Error(
      "Staging target verification and permission review must be recorded first",
    );
  const origin = new URL(config.origin);
  if (
    origin.origin !== config.origin ||
    !(
      origin.origin === "https://stage.diresheets.com" ||
      (origin.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(origin.hostname))
    )
  )
    throw new Error("Only staging or loopback origins are permitted");
}
export async function authorize(
  config: ServerConfig,
  authorization: string | undefined,
  request = fetch,
): Promise<string> {
  validateServerConfig(config);
  if (
    !authorization ||
    !/^Bearer [A-Za-z0-9._-]+$/.test(authorization) ||
    authorization.length > 8192
  )
    throw new Error("Unauthorized");
  // Verify with the pinned staging Auth service, never trust a locally decoded token or user_metadata.
  const response = await request(
    `${config.supabaseUrl.replace(/\/$/, "")}/auth/v1/user`,
    {
      headers: { authorization, apikey: config.publishableKey },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error("Unauthorized");
  const user = (await response.json()) as {
    id?: string;
    is_anonymous?: boolean;
    app_metadata?: { catalogue_role?: string };
  };
  if (
    !user.id ||
    user.is_anonymous !== false ||
    user.app_metadata?.catalogue_role !== "admin"
  )
    throw new Error("Catalogue administrator permission required");
  return user.id;
}
