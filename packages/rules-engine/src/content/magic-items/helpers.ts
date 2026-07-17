import type { Modifier } from "../../types";
import type {
  MagicItemDefinition,
  MagicItemSlot,
  MagicItemAutomationStatus,
} from "./shared";

type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

type SkillKey =
  | "acrobatics"
  | "appraise"
  | "bluff"
  | "climb"
  | "craft"
  | "diplomacy"
  | "disable-device"
  | "escape-artist"
  | "intimidate"
  | "perception"
  | "sleight-of-hand"
  | "spellcraft"
  | "stealth"
  | "swim"
  | "use-magic-device";

interface BaseItemArgs {
  id: string;
  name: string;
  slot: MagicItemSlot;
  weightLb: number;
  costGp: number;
  modifiers?: Modifier[];
  source?: string;
  sourcePage?: number;
  casterLevel?: number;
  aura?: string;
  tags?: string[];
  rulesText?: string;
  automationStatus?: MagicItemAutomationStatus;
  automationNotes?: string;
  upgradeGroup?: string;
  upgradeTier?: number;
  upgradeToId?: string;
  downgradeToId?: string;
}

export function item(args: BaseItemArgs): MagicItemDefinition {
  return {
    ...args,
    modifiers: args.modifiers ?? [],
    source: args.source ?? "Core Rulebook",
    automation: {
      status:
        args.automationStatus ??
        ((args.modifiers?.length ?? 0) > 0 ? "automated" : "manual"),
      notes: args.automationNotes,
    },
  };
}

export function enhancementAbilityChain(args: {
  key: AbilityKey;
  sourceBase: string;
  itemBaseName: string;
  slot: MagicItemSlot;
  weightLb: number;
  values: number[];
  costs: number[];
  automationStatus?: MagicItemAutomationStatus;
  automationNotes?: string;
  tags?: string[];
}) {
  const slug = args.itemBaseName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return args.values.map((value, index, values) =>
    item({
      id: `${slug}-${value}`,
      name: `${args.itemBaseName} +${value}`,
      slot: args.slot,
      weightLb: args.weightLb,
      costGp: args.costs[index] ?? 0,
      modifiers: [
        {
          target: args.key,
          type: "enhancement",
          value,
          source: `${args.sourceBase} +${value}`,
          pack: "core",
        },
      ],
      tags: args.tags,
      automationStatus: args.automationStatus,
      automationNotes: args.automationNotes,
      upgradeGroup: slug,
      upgradeTier: index + 1,
      upgradeToId:
        index < values.length - 1 ? `${slug}-${values[index + 1]}` : undefined,
      downgradeToId: index > 0 ? `${slug}-${values[index - 1]}` : undefined,
    }),
  );
}

export function acBonusChain(args: {
  slug: string;
  nameBase: string;
  slot: MagicItemSlot;
  weightLb: number;
  values: number[];
  costs: number[];
  type: "armor" | "deflection" | "natural-armor";
  tags?: string[];
}) {
  return args.values.map((value, index, values) =>
    item({
      id: `${args.slug}-${value}`,
      name: `${args.nameBase} +${value}`,
      slot: args.slot,
      weightLb: args.weightLb,
      costGp: args.costs[index] ?? 0,
      modifiers: [
        {
          target: "ac",
          type: args.type,
          value,
          source: `${args.nameBase} +${value}`,
          pack: "core",
        },
      ],
      tags: args.tags,
      upgradeGroup: args.slug,
      upgradeTier: index + 1,
      upgradeToId:
        index < values.length - 1
          ? `${args.slug}-${values[index + 1]}`
          : undefined,
      downgradeToId:
        index > 0 ? `${args.slug}-${values[index - 1]}` : undefined,
    }),
  );
}

export function allSavesChain(args: {
  slug: string;
  nameBase: string;
  slot: MagicItemSlot;
  weightLb: number;
  values: number[];
  costs: number[];
  tags?: string[];
}) {
  return args.values.map((value, index, values) =>
    item({
      id: `${args.slug}-${value}`,
      name: `${args.nameBase} +${value}`,
      slot: args.slot,
      weightLb: args.weightLb,
      costGp: args.costs[index] ?? 0,
      modifiers: [
        {
          target: "save.all",
          type: "resistance",
          value,
          source: `${args.nameBase} +${value}`,
          pack: "core",
        },
      ],
      tags: args.tags,
      upgradeGroup: args.slug,
      upgradeTier: index + 1,
      upgradeToId:
        index < values.length - 1
          ? `${args.slug}-${values[index + 1]}`
          : undefined,
      downgradeToId:
        index > 0 ? `${args.slug}-${values[index - 1]}` : undefined,
    }),
  );
}

export function skillBonusItem(args: {
  id: string;
  name: string;
  slot: MagicItemSlot;
  weightLb: number;
  costGp: number;
  skill: SkillKey;
  value: number;
  type?: Modifier["type"];
  tags?: string[];
}) {
  return item({
    id: args.id,
    name: args.name,
    slot: args.slot,
    weightLb: args.weightLb,
    costGp: args.costGp,
    tags: args.tags,
    modifiers: [
      {
        target: `skill.${args.skill}`,
        type: args.type ?? "competence",
        value: args.value,
        source: args.name,
        pack: "core",
      },
    ],
  });
}

export function multiSkillBonusItem(args: {
  id: string;
  name: string;
  slot: MagicItemSlot;
  weightLb: number;
  costGp: number;
  skills: SkillKey[];
  value: number;
  type?: Modifier["type"];
  tags?: string[];
}) {
  return item({
    id: args.id,
    name: args.name,
    slot: args.slot,
    weightLb: args.weightLb,
    costGp: args.costGp,
    tags: args.tags,
    modifiers: args.skills.map((skill) => ({
      target: `skill.${skill}`,
      type: args.type ?? "competence",
      value: args.value,
      source: args.name,
      pack: "core",
    })),
  });
}

export function speedItem(args: {
  id: string;
  name: string;
  slot: MagicItemSlot;
  weightLb: number;
  costGp: number;
  value: number;
  tags?: string[];
}) {
  return item({
    id: args.id,
    name: args.name,
    slot: args.slot,
    weightLb: args.weightLb,
    costGp: args.costGp,
    tags: args.tags,
    modifiers: [
      {
        target: "speed",
        type: "enhancement",
        value: args.value,
        source: args.name,
        pack: "core",
      },
    ],
  });
}
