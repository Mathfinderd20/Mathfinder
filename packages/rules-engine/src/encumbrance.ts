import type { Encumbrance, LoadBand } from "./types";

/** PF1e carrying capacity table for Medium bipeds, Str 1-29. */
const LOAD_TABLE: Record<
  number,
  [light: number, medium: number, heavy: number]
> = {
  1: [3, 6, 10],
  2: [6, 13, 20],
  3: [10, 20, 30],
  4: [13, 26, 40],
  5: [16, 33, 50],
  6: [20, 40, 60],
  7: [23, 46, 70],
  8: [26, 53, 80],
  9: [30, 60, 90],
  10: [33, 66, 100],
  11: [38, 76, 115],
  12: [43, 86, 130],
  13: [50, 100, 150],
  14: [58, 116, 175],
  15: [66, 133, 200],
  16: [76, 153, 230],
  17: [86, 173, 260],
  18: [100, 200, 300],
  19: [116, 233, 350],
  20: [133, 266, 400],
  21: [153, 306, 460],
  22: [173, 346, 520],
  23: [200, 400, 600],
  24: [233, 466, 700],
  25: [266, 533, 800],
  26: [306, 613, 920],
  27: [346, 693, 1040],
  28: [400, 800, 1200],
  29: [466, 933, 1400],
};

export function loadThresholds(strScore: number): {
  lightMax: number;
  mediumMax: number;
  heavyMax: number;
} {
  if (strScore <= 0) return { lightMax: 0, mediumMax: 0, heavyMax: 0 };
  if (strScore <= 29) {
    const [lightMax, mediumMax, heavyMax] = LOAD_TABLE[strScore]!;
    return { lightMax, mediumMax, heavyMax };
  }
  // PF1e: every +10 Str multiplies carrying capacity by 4.
  const reduced = loadThresholds(strScore - 10);
  return {
    lightMax: reduced.lightMax * 4,
    mediumMax: reduced.mediumMax * 4,
    heavyMax: reduced.heavyMax * 4,
  };
}

export function loadBand(
  carriedWeight: number,
  heavyMax: number,
  mediumMax: number,
  lightMax: number,
): LoadBand {
  if (carriedWeight <= lightMax) return "light";
  if (carriedWeight <= mediumMax) return "medium";
  if (carriedWeight <= heavyMax) return "heavy";
  return "overloaded";
}

export function deriveEncumbrance(
  strScore: number,
  carriedWeight = 0,
): Encumbrance {
  const { lightMax, mediumMax, heavyMax } = loadThresholds(strScore);
  return {
    carriedWeight,
    lightMax,
    mediumMax,
    heavyMax,
    band: loadBand(carriedWeight, heavyMax, mediumMax, lightMax),
  };
}
