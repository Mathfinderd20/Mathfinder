import type { MagicItemDefinition } from "./shared";
import { acBonusChain, item } from "./helpers";

export const WRISTS_ITEMS: MagicItemDefinition[] = [
  ...acBonusChain({
    slug: "bracers-of-armor",
    nameBase: "Bracers of Armor",
    slot: "wrists",
    weightLb: 1,
    values: [1, 2, 3, 4, 5, 6, 7, 8],
    costs: [1000, 4000, 9000, 16000, 25000, 36000, 49000, 64000],
    type: "armor",
    tags: ["ac"],
  }),
  item({
    id: "bracelets-of-friends",
    name: "Bracelets of Friends",
    slot: "wrists",
    weightLb: 0,
    costGp: 19000,
    tags: ["teleportation"],
  }),
  item({
    id: "bracers-of-archery-lesser",
    name: "Bracers of Archery, Lesser",
    slot: "wrists",
    weightLb: 1,
    costGp: 5000,
    tags: ["archery"],
    automationStatus: "manual",
    automationNotes: "Weapon-group bonuses not yet modeled.",
  }),
  item({
    id: "bracers-of-archery-greater",
    name: "Bracers of Archery, Greater",
    slot: "wrists",
    weightLb: 1,
    costGp: 25000,
    tags: ["archery"],
    automationStatus: "manual",
    automationNotes: "Weapon-group bonuses not yet modeled.",
  }),
  item({
    id: "manacles-of-cooperation",
    name: "Manacles of Cooperation",
    slot: "wrists",
    weightLb: 2,
    costGp: 5000,
    tags: ["teamwork"],
  }),
  item({
    id: "bracelet-of-mercy",
    name: "Bracelet of Mercy",
    slot: "wrists",
    weightLb: 0,
    costGp: 15000,
    tags: ["healing"],
  }),
];
