import { describe, expect, it } from "vitest";
import {
  createOptionalSupabaseClient,
  readSupabaseConfig,
} from "./supabaseClient";

describe("Supabase client configuration", () => {
  it("keeps cloud services disabled when configuration is absent", () => {
    expect(readSupabaseConfig({})).toBeUndefined();
    expect(createOptionalSupabaseClient({})).toBeUndefined();
  });

  it("accepts hosted HTTPS configuration", () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: " https://example.supabase.co ",
        VITE_SUPABASE_PUBLISHABLE_KEY: " publishable-key ",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "publishable-key",
    });
  });

  it("uses the client-only implicit auth flow for cross-tab magic links", () => {
    const client = createOptionalSupabaseClient({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });
    expect((client?.auth as unknown as { flowType: string }).flowType).toBe(
      "implicit",
    );
  });

  it("accepts local HTTP but rejects unsafe protocols and remote HTTP", () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "local-key",
      }),
    ).toBeDefined();
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: "http://localhost:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "local-key",
      }),
    ).toBeDefined();
    for (const unsafeUrl of [
      "http://example.com",
      "ftp://127.0.0.1:54321",
      "javascript:alert(1)",
    ]) {
      expect(
        readSupabaseConfig({
          VITE_SUPABASE_URL: unsafeUrl,
          VITE_SUPABASE_PUBLISHABLE_KEY: "bad-key",
        }),
      ).toBeUndefined();
    }
  });
});
