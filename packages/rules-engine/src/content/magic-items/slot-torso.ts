import type { MagicItemDefinition } from "./shared";
import { item } from "./helpers";

export const TORSO_ITEMS: MagicItemDefinition[] = [
  item({
    id: "corset-of-delicate-moves",
    name: "Corset of Delicate Moves",
    slot: "torso",
    weightLb: 1,
    costGp: 4000,
    tags: ["mobility"],
  }),
  item({
    id: "shirt-of-immolation",
    name: "Shirt of Immolation",
    slot: "torso",
    weightLb: 1,
    costGp: 10000,
    tags: ["fire"],
  }),
  item({
    id: "vest-of-stable-mutation",
    name: "Vest of Stable Mutation",
    slot: "torso",
    weightLb: 1,
    costGp: 20000,
    tags: ["alchemist"],
    automationStatus: "manual",
    automationNotes: "Class-specific mutation rules not yet modeled.",
  }),
  item({
    id: "vest-of-surgery",
    name: "Vest of Surgery",
    slot: "torso",
    weightLb: 1,
    costGp: 10000,
    tags: ["healing"],
  }),
];
