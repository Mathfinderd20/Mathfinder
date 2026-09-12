import { createHash } from "node:crypto";

/** Build and operator entry points share the exact release-integrity check. */
export function verifyRuntimeRelease(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid staging catalogue release");
  const { catalogueManifest, ...content } = value as {
    catalogueManifest?: {
      schema?: string;
      target?: string;
      transitionReference?: string;
      contentHash?: string;
    };
  };
  if (
    catalogueManifest?.schema !== "reviewed-runtime/1" ||
    catalogueManifest.target !== "pkupqzdnefnjwndwzhdr" ||
    !catalogueManifest.transitionReference ||
    catalogueManifest.contentHash !==
      createHash("sha256").update(JSON.stringify(content)).digest("hex")
  )
    throw new Error("Invalid or changed staging catalogue release");
  return catalogueManifest.contentHash;
}
