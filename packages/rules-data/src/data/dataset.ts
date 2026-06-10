import type { RulesDataSet } from "../types";
import { CORE_RULES_PACK } from "./core/pack";
import { SAVAGE_COMPANY_RULES_PACK } from "./savage-company/pack";

export const RULES_DATA_SET: RulesDataSet = {
  schemaVersion: "0.1.0",
  generatedAt: "2026-06-07T00:00:00Z",
  sources: [
    {
      id: "paizo-prd",
      name: "Paizo PRD / 1st-Party Seed",
      publisher: "Paizo",
      product: "Pathfinder Roleplaying Game Reference Document",
      type: "first-party",
      license: "prdofficial",
      notes: "Starter seed pack. Expand incrementally with provenance preserved.",
    },
    {
      id: "savage-company",
      name: "Savage Company",
      publisher: "SHM Publishing",
      product: "Savage Company",
      type: "owner-authored",
      license: "owner-approved",
      notes: "Owner-authored content pack scaffold.",
    },
  ],
  packs: [CORE_RULES_PACK, SAVAGE_COMPANY_RULES_PACK],
};
