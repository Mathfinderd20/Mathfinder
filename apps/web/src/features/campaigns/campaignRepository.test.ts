import { describe, expect, it } from "vitest";
import type { StorageLike } from "../characters/characterRepository";
import {
  campaignsForCharacter,
  characterIdsForCampaign,
  createCampaign,
  listCampaigns,
  setCampaignCharacterAssignment,
} from "./campaignRepository";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const options = {
  now: () => "2026-08-03T12:00:00.000Z",
  createId: () => "campaign-1",
};

describe("campaign repository", () => {
  it("creates an empty GM campaign", () => {
    const storage = new MemoryStorage();
    const campaign = createCampaign(
      storage,
      { name: "  Rise of the Runelords  " },
      options,
    );

    expect(campaign).toMatchObject({
      id: "campaign-1",
      name: "Rise of the Runelords",
      role: "gm",
    });
    expect(characterIdsForCampaign(storage, campaign.id)).toEqual([]);
  });

  it("assigns several characters without duplicating links", () => {
    const storage = new MemoryStorage();
    const campaign = createCampaign(
      storage,
      {
        name: "Kingmaker",
        characterIds: ["hero-1", "hero-2", "hero-1"],
      },
      options,
    );

    expect(characterIdsForCampaign(storage, campaign.id)).toEqual([
      "hero-1",
      "hero-2",
    ]);
    expect(campaignsForCharacter(storage, "hero-2")).toEqual([campaign]);
  });

  it("adds and removes an assignment independently", () => {
    const storage = new MemoryStorage();
    const campaign = createCampaign(
      storage,
      { name: "Carrion Crown" },
      options,
    );

    setCampaignCharacterAssignment(
      storage,
      campaign.id,
      "hero-1",
      true,
      options,
    );
    expect(characterIdsForCampaign(storage, campaign.id)).toEqual(["hero-1"]);

    setCampaignCharacterAssignment(
      storage,
      campaign.id,
      "hero-1",
      false,
      options,
    );
    expect(characterIdsForCampaign(storage, campaign.id)).toEqual([]);
    expect(listCampaigns(storage)).toHaveLength(1);
  });

  it("rejects blank campaign names", () => {
    expect(() =>
      createCampaign(new MemoryStorage(), { name: "   " }, options),
    ).toThrow("Campaign name is required");
  });
});
