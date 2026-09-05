import { describe, expect, it } from "vitest";
import { formatCampaignCode, normalizeCampaignCode } from "./campaignService";

describe("campaign ID presentation", () => {
  it("normalizes casing, separators, and excess input", () => {
    expect(normalizeCampaignCode(" abcd-1234 ef56-7890-abcd-extra ")).toBe(
      "ABCD1234EF567890ABCD",
    );
  });

  it("formats a stored campaign ID for sharing", () => {
    expect(formatCampaignCode("abcd1234ef567890abcd")).toBe(
      "ABCD-1234-EF56-7890-ABCD",
    );
  });
});
