import type { Modifier } from "../../types";
import type { EquipmentSlot } from "../../build/character";

export type MagicItemSlot = Exclude<EquipmentSlot, "armor" | "shield">;

export type MagicItemAutomationStatus = "automated" | "partial" | "manual";

export interface MagicItemDefinition {
  id: string;
  name: string;
  slot: MagicItemSlot;
  weightLb: number;
  costGp: number;
  modifiers: Modifier[];
  source: string;
  sourcePage?: number;
  casterLevel?: number;
  aura?: string;
  tags?: string[];
  rulesText?: string;
  automation: {
    status: MagicItemAutomationStatus;
    notes?: string;
  };
  upgradeGroup?: string;
  upgradeTier?: number;
  upgradeToId?: string;
  downgradeToId?: string;
}

export interface EquipmentMagicItemTemplate {
  itemTemplateId: string;
  name: string;
  weight: number;
  costGp: number;
  slot: MagicItemDefinition["slot"];
  modifiers: Modifier[];
}
