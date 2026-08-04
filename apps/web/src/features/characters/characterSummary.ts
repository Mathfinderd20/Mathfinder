import type { CharacterRecord } from "./characterRepository";

export interface CharacterSummary {
  ancestry: string;
  classes: string;
  levelLabel: string;
  updatedLabel: string;
}

function classSummary(record: CharacterRecord) {
  const counts = new Map<string, number>();
  for (const level of record.build.levels.slice(0, record.currentLevel)) {
    const name = level.className.trim() || "Unknown class";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, levels]) => `${name} ${levels}`)
    .join(" / ");
}

export function summarizeCharacter(
  record: CharacterRecord,
  now = new Date(),
): CharacterSummary {
  const updated = new Date(record.updatedAt);
  const elapsedDays = Math.max(
    0,
    Math.floor((now.getTime() - updated.getTime()) / 86_400_000),
  );
  const updatedLabel =
    elapsedDays === 0
      ? "Edited today"
      : elapsedDays === 1
        ? "Edited yesterday"
        : elapsedDays < 30
          ? `Edited ${elapsedDays} days ago`
          : `Edited ${updated.toLocaleDateString()}`;
  return {
    ancestry: record.build.race.name?.trim() || "Unknown ancestry",
    classes: classSummary(record) || "No class selected",
    levelLabel: `Level ${record.currentLevel}`,
    updatedLabel,
  };
}
