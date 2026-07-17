import type { MagicItemDefinition } from "./shared";
import { item, multiSkillBonusItem } from "./helpers";

export const CHEST_ITEMS: MagicItemDefinition[] = [
  multiSkillBonusItem({
    id: "vest-of-escape",
    name: "Vest of Escape",
    slot: "chest",
    weightLb: 1,
    costGp: 5200,
    skills: ["disable-device", "escape-artist", "sleight-of-hand"],
    value: 4,
    tags: ["skills"],
  }),
  item({
    id: "cassock-of-the-clergy",
    name: "Cassock of the Clergy",
    slot: "chest",
    weightLb: 1,
    costGp: 4600,
    tags: ["divine"],
  }),
  item({
    id: "medallion-of-thoughts",
    name: "Medallion of Thoughts",
    slot: "chest",
    weightLb: 1,
    costGp: 12000,
    tags: ["detect-thoughts"],
  }),
  item({
    id: "scarab-breastplate",
    name: "Scarab Breastplate",
    slot: "chest",
    weightLb: 1,
    costGp: 8000,
    tags: ["defense"],
  }),
  item({
    id: "brooch-of-instantly",
    name: "Brooch of Instantly",
    slot: "chest",
    weightLb: 1,
    costGp: 3000,
    tags: ["utility"],
  }),
];
