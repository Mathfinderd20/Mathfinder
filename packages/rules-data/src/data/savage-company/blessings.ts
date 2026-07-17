import type { BlessingDefinition } from "../../types";

export const SAVAGE_COMPANY_BLESSINGS: BlessingDefinition[] = [
  {
    id: "crusade",
    name: "Crusade",
    pack: "savage-company",
    baseClassName: "Warpriest",
    description:
      "A siege-oriented blessing for holy artillery crews and battlefield engineers.",
    minor:
      "Targeted Retribution: when using a firearm or siege engine that targets an area, focus the brunt on one creature in the area for extra precision damage equal to your level.",
    major:
      "Hands of the Legion: empower yourself and up to eight others to count as twice as many workers, or cut time in half, when assembling or disassembling siege engines for one day.",
  },
];
