import type { CharacterNote } from "./characterRepository";

export const noteSorts = {
  title: "Title Alpha",
  newest: "New–Old",
  oldest: "Old–New",
  category: "Category Alpha",
} as const;
export type NoteSort = keyof typeof noteSorts;
export function parseNoteSort(value: string | null): NoteSort {
  return value && Object.prototype.hasOwnProperty.call(noteSorts, value)
    ? (value as NoteSort)
    : "title";
}
export function filterCharacterNotes(
  notes: CharacterNote[],
  search: string,
  sort: NoteSort = "title",
) {
  const query = search.trim().toLowerCase();
  return notes
    .map((note, index) => ({ note, index }))
    .filter(({ note }) =>
      `${note.title} ${note.category} ${note.body}`
        .toLowerCase()
        .includes(query),
    )
    .sort((a, b) => {
      const pinned = Number(b.note.pinned) - Number(a.note.pinned);
      if (pinned) return pinned;
      if (sort === "newest" || sort === "oldest") {
        // Undated legacy notes retain their original creation order, before dated notes.
        const date = (note: CharacterNote) =>
          Date.parse(note.createdAt ?? "") || 0;
        const order = date(a.note) - date(b.note) || a.index - b.index;
        return sort === "newest" ? -order : order;
      }
      return (
        (sort === "category"
          ? a.note.category.localeCompare(b.note.category)
          : 0) || a.note.title.localeCompare(b.note.title)
      );
    })
    .map(({ note }) => note);
}
