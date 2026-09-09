import type { CharacterNote } from "./characterRepository";

export const NOTE_CATEGORIES = [
  "General",
  "Origin",
  "Campaign",
  "Sessions",
  "NPCs",
  "Allies",
  "Villains",
  "Locations",
  "Quests",
  "Clues",
  "Plans",
  "Treasure",
];

export function noteCategories(notes: CharacterNote[]) {
  return [
    ...new Set([...NOTE_CATEGORIES, ...notes.map((note) => note.category)]),
  ];
}

/** Only edited fields are buffered, so unrelated incoming changes survive. */
export class NoteDraft {
  private patches = new Map<string, Partial<CharacterNote>>();
  private removed = new Set<string>();
  private saveRequested = false;

  get dirty() {
    return this.patches.size > 0 || this.removed.size > 0;
  }

  update(id: string, patch: Partial<CharacterNote>) {
    if (this.removed.has(id)) return;
    this.patches.set(id, { ...this.patches.get(id), ...patch });
  }

  view(notes: CharacterNote[]) {
    return notes
      .filter((note) => !this.removed.has(note.id))
      .map((note) => ({ ...note, ...this.patches.get(note.id) }));
  }

  discard(id: string) {
    this.patches.delete(id);
  }

  remove(id: string) {
    this.discard(id);
    this.removed.add(id);
  }

  flush(
    notes: CharacterNote[],
    save: (next: CharacterNote[]) => void | boolean,
  ) {
    this.saveRequested = this.dirty;
    this.retry(notes, save);
  }

  retry(
    notes: CharacterNote[],
    save: (next: CharacterNote[]) => void | boolean,
  ) {
    if (!this.saveRequested) return;
    if (!this.dirty) return;
    const next = this.view(notes);
    if (save(next) === false) return;
    this.patches.clear();
    this.removed.clear();
    this.saveRequested = false;
  }
}
