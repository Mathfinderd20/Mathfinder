import type { HexDefinition } from "../../types";

export const SAVAGE_COMPANY_WITCH_HEXES: HexDefinition[] = [
  {
    id: "friendly-fire",
    name: "Friendly Fire",
    pack: "savage-company",
    baseClassName: "Witch",
    category: "hex",
    description:
      "As an immediate action, redirect a ranged attack targeting you so the attacker instead targets its nearest ally within 30 feet; Will negates and the target is then immune for 1 day.",
  },
  {
    id: "light-strike",
    name: "Light Strike",
    pack: "savage-company",
    baseClassName: "Witch",
    category: "hex",
    description:
      "As a standard action, curse a firearm user with a 1–5 misfire range for 1 round and a chance for catastrophic explosion on a true misfire; Will negates and grants 1-day immunity.",
  },
  {
    id: "etched-bullets",
    name: "Etched Bullets",
    pack: "savage-company",
    baseClassName: "Witch",
    category: "hex",
    description:
      "Gain Scribe Scroll and etch scroll formulae onto bullets, casting them from or through your firearm with firearm attack/save enhancements applying where relevant.",
  },
  {
    id: "gunsmith",
    name: "Gunsmith",
    pack: "savage-company",
    baseClassName: "Witch",
    category: "hex",
    description: "Gain the Gunsmithing feat as a hex option.",
  },
];
