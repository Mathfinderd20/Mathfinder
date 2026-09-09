import { describe, expect, it } from "vitest";
import {
  readAppEnvironment,
  validateWebBuildEnvironment,
} from "./buildEnvironment";

const validStageEnvironment = {
  VITE_APP_ENV: "staging",
  VITE_SUPABASE_URL: "https://example-stage.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
};

describe("application environment", () => {
  it("accepts only known environment names", () => {
    expect(readAppEnvironment("staging")).toBe("staging");
    expect(() => readAppEnvironment("stage")).toThrow("VITE_APP_ENV");
  });

  it("accepts an isolated staging configuration", () => {
    expect(validateWebBuildEnvironment(validStageEnvironment)).toMatchObject({
      appEnvironment: "staging",
      supabaseUrl: validStageEnvironment.VITE_SUPABASE_URL,
    });
  });

  it("rejects staging builds wired to production", () => {
    expect(() =>
      validateWebBuildEnvironment({
        ...validStageEnvironment,
        VITE_SUPABASE_URL: "https://guronltdufvmnwnjqggd.supabase.co",
      }),
    ).toThrow("production Supabase");
    expect(() =>
      validateWebBuildEnvironment({
        ...validStageEnvironment,
        VITE_SUPABASE_URL: "https://auth.diresheets.com",
      }),
    ).toThrow("production Supabase");
  });

  it("rejects server-only credentials", () => {
    expect(() =>
      validateWebBuildEnvironment({
        ...validStageEnvironment,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_never_ship_this",
      }),
    ).toThrow("service-role");
  });
});
