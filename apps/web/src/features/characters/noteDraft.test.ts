import { describe, expect, it, vi } from "vitest";
import { NoteDraft, noteCategories } from "./noteDraft";
import type { CharacterNote } from "./characterRepository";

const note: CharacterNote = {
  id: "one",
  title: "Origin",
  body: "Old text",
  category: "General",
  pinned: false,
};

describe("note departure saves", () => {
  it("deletes an edited note and saves other pending edits in one update", () => {
    const draft = new NoteDraft();
    const other = { ...note, id: "two" };
    draft.update(note.id, { body: "Discard this draft" });
    draft.update(other.id, { body: "Keep this draft" });
    draft.remove(note.id);
    const save = vi.fn();
    draft.flush([note, other], save);
    expect(save).toHaveBeenCalledExactlyOnceWith([
      { ...other, body: "Keep this draft" },
    ]);
    expect(draft.dirty).toBe(false);
  });

  it("retains a deletion through a sync lock and cannot resurrect it from a late paste", () => {
    const draft = new NoteDraft();
    draft.remove(note.id);
    draft.flush([note], () => false);
    draft.update(note.id, { body: "Late clipboard result" });
    expect(draft.view([note])).toEqual([]);
    expect(draft.dirty).toBe(true);
    const other = { ...note, id: "new-remote-note" };
    const save = vi.fn();
    draft.retry([note, other], save);
    expect(save).toHaveBeenCalledExactlyOnceWith([other]);
    expect(draft.dirty).toBe(false);
  });

  it("persists deleting the last note as an empty collection, once", () => {
    const draft = new NoteDraft();
    draft.remove(note.id);
    const save = vi.fn();
    draft.flush([note], save);
    draft.flush([], save);
    expect(save).toHaveBeenCalledExactlyOnceWith([]);
  });

  it("buffers repeated typing without persistence and saves the latest text once on departure", () => {
    const draft = new NoteDraft();
    const save = vi.fn();
    for (const body of ["H", "He", "Hello"]) {
      draft.update(note.id, { body });
      draft.retry([note], save); // Background sync notifications aren't departures.
    }
    expect(save).not.toHaveBeenCalled();
    expect(draft.view([note])[0]?.body).toBe("Hello");
    expect(note.body).toBe("Old text");
    draft.flush([note], save); // Switch note, workspace tab, route, or hide page.
    draft.flush([note], save); // Cleanup may also fire; no duplicate write.
    expect(save).toHaveBeenCalledExactlyOnceWith([{ ...note, body: "Hello" }]);
    expect(draft.dirty).toBe(false);
  });

  it("preserves unedited fields and other notes from the latest saved data", () => {
    const draft = new NoteDraft();
    draft.update(note.id, { body: "My draft" });
    draft.update(note.id, { category: "Villains" });
    const other = { ...note, id: "two", title: "Another note" };
    const save = vi.fn();
    draft.flush([{ ...note, pinned: true }, other], save);
    expect(save).toHaveBeenCalledWith([
      { ...note, pinned: true, category: "Villains", body: "My draft" },
      other,
    ]);
  });

  it("retains a departure save across a temporary persistence lock", () => {
    const draft = new NoteDraft();
    draft.update(note.id, { body: "Retain me" });
    draft.flush([note], () => false);
    expect(draft.dirty).toBe(true);
    const save = vi.fn();
    draft.retry([note], save);
    expect(save).toHaveBeenCalledExactlyOnceWith([
      { ...note, body: "Retain me" },
    ]);
    expect(draft.dirty).toBe(false);
  });

  it("keeps drafts if persistence throws", () => {
    const draft = new NoteDraft();
    draft.update(note.id, { body: "Keep me" });
    expect(() =>
      draft.flush([note], () => {
        throw new Error("Unavailable");
      }),
    ).toThrow("Unavailable");
    expect(draft.dirty).toBe(true);
  });

  it("doesn't resurrect deleted notes and allows discarded drafts", () => {
    const draft = new NoteDraft();
    draft.update(note.id, { body: "Removed" });
    expect(draft.view([])).toEqual([]);
    draft.discard(note.id);
    const save = vi.fn();
    draft.flush([], save);
    expect(save).not.toHaveBeenCalled();
  });

  it("offers useful categories without dropping legacy or custom choices", () => {
    const categories = noteCategories([
      { ...note, category: "My custom lore" },
      note,
    ]);
    expect(categories).toEqual(
      expect.arrayContaining([
        "General",
        "Origin",
        "Campaign",
        "NPCs",
        "Villains",
        "My custom lore",
      ]),
    );
    expect(
      categories.filter((category) => category === "General"),
    ).toHaveLength(1);
  });
});
