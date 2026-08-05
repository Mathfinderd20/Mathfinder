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

  it("accepts the local Supabase URL and rejects unsafe remote HTTP", () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_PUBLISHABLE_KEY: "local-key",
      }),
    ).toBeDefined();
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: "http://example.com",
        VITE_SUPABASE_PUBLISHABLE_KEY: "bad-key",
      }),
    ).toBeUndefined();
  });
});
