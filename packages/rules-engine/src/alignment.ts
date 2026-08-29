export const ALIGNMENTS = [
  "lawful-good",
  "neutral-good",
  "chaotic-good",
  "lawful-neutral",
  "true-neutral",
  "chaotic-neutral",
  "lawful-evil",
  "neutral-evil",
  "chaotic-evil",
] as const;

export type Alignment = (typeof ALIGNMENTS)[number];
export type AlignmentEthic = "lawful" | "neutral" | "chaotic";
export type AlignmentMorality = "good" | "neutral" | "evil";

export const ALIGNMENT_LABELS: Record<Alignment, string> = {
  "lawful-good": "Lawful Good",
  "neutral-good": "Neutral Good",
  "chaotic-good": "Chaotic Good",
  "lawful-neutral": "Lawful Neutral",
  "true-neutral": "True Neutral",
  "chaotic-neutral": "Chaotic Neutral",
  "lawful-evil": "Lawful Evil",
  "neutral-evil": "Neutral Evil",
  "chaotic-evil": "Chaotic Evil",
};

export function alignmentEthic(alignment: Alignment): AlignmentEthic {
  if (alignment.startsWith("lawful-")) return "lawful";
  if (alignment.startsWith("chaotic-")) return "chaotic";
  return "neutral";
}

export function alignmentMorality(alignment: Alignment): AlignmentMorality {
  if (alignment.endsWith("-good")) return "good";
  if (alignment.endsWith("-evil")) return "evil";
  return "neutral";
}

export function alignmentHasNeutralComponent(alignment: Alignment): boolean {
  return (
    alignmentEthic(alignment) === "neutral" ||
    alignmentMorality(alignment) === "neutral"
  );
}

export function isAlignment(value: unknown): value is Alignment {
  return ALIGNMENTS.includes(value as Alignment);
}
