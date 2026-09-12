import type { Dispatch, SetStateAction } from "react";
import type { CharacterBuild } from "@mathfinder/rules-engine";

type SpellSelectionMode = "prepared" | "known";

/** One state update keeps multi-copy preparations atomic, including batched clicks. */
export function appendSelectionToBuild(
  previous: CharacterBuild,
  classKey: string,
  mode: SpellSelectionMode,
  level: number,
  spellName: string,
  copies = 1,
): CharacterBuild {
  const name = spellName.trim();
  if (!name || !Number.isFinite(copies) || copies < 1) return previous;
  const selections = previous.spellSelections ?? {};
  const source = selections[classKey] ?? {};
  const byLevel = source[mode] ?? {};
  const current = byLevel[level] ?? [];
  if (
    mode === "known" &&
    current.some((value) => value.toLowerCase() === name.toLowerCase())
  )
    return previous;
  return {
    ...previous,
    spellSelections: {
      ...selections,
      [classKey]: {
        ...source,
        [mode]: {
          ...byLevel,
          [level]: [
            ...current,
            ...Array.from(
              { length: mode === "known" ? 1 : Math.floor(copies) },
              () => name,
            ),
          ],
        },
      },
    },
  };
}

export function useSpellbookEditor(
  build: CharacterBuild,
  setBuild: Dispatch<SetStateAction<CharacterBuild>>,
) {
  function updateSpellSelections(
    classKey: string,
    mode: SpellSelectionMode,
    level: number,
    spells: string[],
  ) {
    setBuild((previous) => {
      const spellSelections = { ...(previous.spellSelections ?? {}) };
      const classSelections = { ...(spellSelections[classKey] ?? {}) };
      const levelSelections = { ...(classSelections[mode] ?? {}) };

      if (spells.length > 0) levelSelections[level] = spells;
      else delete levelSelections[level];

      if (Object.keys(levelSelections).length > 0)
        classSelections[mode] = levelSelections;
      else delete classSelections[mode];

      if (Object.keys(classSelections).length > 0)
        spellSelections[classKey] = classSelections;
      else delete spellSelections[classKey];

      return {
        ...previous,
        spellSelections:
          Object.keys(spellSelections).length > 0 ? spellSelections : undefined,
      };
    });
  }

  function addSpellSelection(
    classKey: string,
    mode: SpellSelectionMode,
    level: number,
  ) {
    const current = build.spellSelections?.[classKey]?.[mode]?.[level] ?? [];
    updateSpellSelections(classKey, mode, level, [...current, ""]);
  }

  function updateSpellSelectionName(
    classKey: string,
    mode: SpellSelectionMode,
    level: number,
    index: number,
    value: string,
  ) {
    const current = [
      ...(build.spellSelections?.[classKey]?.[mode]?.[level] ?? []),
    ];
    current[index] = value;
    updateSpellSelections(classKey, mode, level, current);
  }

  function removeSpellSelection(
    classKey: string,
    mode: SpellSelectionMode,
    level: number,
    index: number,
  ) {
    const current = build.spellSelections?.[classKey]?.[mode]?.[level] ?? [];
    updateSpellSelections(
      classKey,
      mode,
      level,
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function resetSpellSelectionsForLevel(
    classKey: string,
    mode: SpellSelectionMode,
    level: number,
  ) {
    updateSpellSelections(classKey, mode, level, []);
  }

  function appendSpellSelection(
    classKey: string,
    mode: SpellSelectionMode,
    level: number,
    spellName: string,
    copies = 1,
  ) {
    setBuild((previous) =>
      appendSelectionToBuild(
        previous,
        classKey,
        mode,
        level,
        spellName,
        copies,
      ),
    );
  }

  function resetSpellSelectionsForClass(
    classKey: string,
    mode: SpellSelectionMode,
    _levels: number[],
  ) {
    setBuild((previous) => {
      const spellSelections = { ...(previous.spellSelections ?? {}) };
      const classSelections = { ...(spellSelections[classKey] ?? {}) };
      delete classSelections[mode];

      if (Object.keys(classSelections).length > 0)
        spellSelections[classKey] = classSelections;
      else delete spellSelections[classKey];

      return {
        ...previous,
        spellSelections:
          Object.keys(spellSelections).length > 0 ? spellSelections : undefined,
      };
    });
  }

  function updateSpellSpecialization(classKey: string, value: string) {
    setBuild((previous) => ({
      ...previous,
      spellSpecializations: {
        ...(previous.spellSpecializations ?? {}),
        [classKey]: value || undefined,
      },
    }));
  }

  function updateSpellDomains(classKey: string, index: number, value: string) {
    const current = [...(build.spellDomains?.[classKey] ?? [])];
    current[index] = value;
    setBuild((previous) => ({
      ...previous,
      spellDomains: {
        ...(previous.spellDomains ?? {}),
        [classKey]: current,
      },
    }));
  }
  function updateSpellBloodline(classKey: string, value: string) {
    setBuild((previous) => ({
      ...previous,
      spellBloodlines: { ...previous.spellBloodlines, [classKey]: value },
    }));
  }

  function updateSpellExtraSlots(
    classKey: string,
    level: number,
    value: number,
  ) {
    setBuild((previous) => ({
      ...previous,
      spellExtraSlots: {
        ...(previous.spellExtraSlots ?? {}),
        [classKey]: {
          ...((previous.spellExtraSlots ?? {})[classKey] ?? {}),
          [level]: Math.max(0, value),
        },
      },
    }));
  }

  function adjustSpellExtraSlots(
    classKey: string,
    level: number,
    delta: number,
  ) {
    const current = build.spellExtraSlots?.[classKey]?.[level] ?? 0;
    updateSpellExtraSlots(classKey, level, current + delta);
  }

  function updateSpellLibrary(
    classKey: string,
    level: number,
    spells: string[],
  ) {
    setBuild((previous) => ({
      ...previous,
      spellLibrary: {
        ...(previous.spellLibrary ?? {}),
        [classKey]: {
          ...((previous.spellLibrary ?? {})[classKey] ?? {}),
          [level]: spells,
        },
      },
    }));
  }

  function addSpellLibraryEntry(classKey: string, level: number) {
    const current = build.spellLibrary?.[classKey]?.[level] ?? [];
    updateSpellLibrary(classKey, level, [...current, ""]);
  }

  function appendSpellLibraryEntry(
    classKey: string,
    level: number,
    spellName: string,
  ) {
    const trimmed = spellName.trim();
    if (!trimmed) return;
    const current = build.spellLibrary?.[classKey]?.[level] ?? [];
    if (current.includes(trimmed)) return;
    updateSpellLibrary(classKey, level, [...current, trimmed]);
  }

  function updateSpellLibraryName(
    classKey: string,
    level: number,
    index: number,
    value: string,
  ) {
    const current = [...(build.spellLibrary?.[classKey]?.[level] ?? [])];
    current[index] = value;
    updateSpellLibrary(classKey, level, current);
  }

  function removeSpellLibraryEntry(
    classKey: string,
    level: number,
    index: number,
  ) {
    const current = build.spellLibrary?.[classKey]?.[level] ?? [];
    updateSpellLibrary(
      classKey,
      level,
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function resetSpellLibraryLevel(classKey: string, level: number) {
    updateSpellLibrary(classKey, level, []);
  }

  function resetSpellLibraryForClass(classKey: string, levels: number[]) {
    setBuild((previous) => ({
      ...previous,
      spellLibrary: {
        ...(previous.spellLibrary ?? {}),
        [classKey]: Object.fromEntries(levels.map((level) => [level, []])),
      },
    }));
  }

  function fillSelectionsFromLibrary(
    classKey: string,
    mode: SpellSelectionMode,
    level: number,
    capacity: number,
    availableSpells?: string[],
  ) {
    const source =
      availableSpells ?? build.spellLibrary?.[classKey]?.[level] ?? [];
    const normalized = [
      ...new Set(source.map((spell) => spell.trim()).filter(Boolean)),
    ].slice(0, capacity);
    updateSpellSelections(classKey, mode, level, normalized);
  }

  return {
    addSpellLibraryEntry,
    addSpellSelection,
    adjustSpellExtraSlots,
    appendSpellLibraryEntry,
    appendSpellSelection,
    fillSelectionsFromLibrary,
    removeSpellLibraryEntry,
    removeSpellSelection,
    resetSpellLibraryForClass,
    resetSpellLibraryLevel,
    resetSpellSelectionsForClass,
    resetSpellSelectionsForLevel,
    updateSpellDomains,
    updateSpellBloodline,
    updateSpellLibraryName,
    updateSpellSelectionName,
    updateSpellSpecialization,
  };
}
