import { expect, it } from "vitest";
import { filterCharacterNotes, parseNoteSort } from "./noteSort";
const notes = [
  {
    id: "a",
    title: "Zebra",
    category: "Origin",
    pinned: false,
    body: "forest",
  },
  { id: "b", title: "Apple", category: "Campaign", pinned: false, body: "" },
  { id: "c", title: "Middle", category: "Villains", pinned: true, body: "" },
  {
    id: "d",
    title: "Dated",
    category: "Campaign",
    pinned: false,
    body: "",
    createdAt: "2026-09-09T12:00:00Z",
  },
];
it("sorts pinned first, with stable legacy creation order", () => {
  const ids = (sort: Parameters<typeof filterCharacterNotes>[2]) =>
    filterCharacterNotes(notes, "", sort).map((note) => note.id);
  expect(ids("title")).toEqual(["c", "b", "d", "a"]);
  expect(ids("newest")).toEqual(["c", "d", "b", "a"]);
  expect(ids("oldest")).toEqual(["c", "a", "b", "d"]);
  expect(ids("category")).toEqual(["c", "b", "d", "a"]);
  expect(filterCharacterNotes(notes, "forest")).toEqual([notes[0]]);
  expect(notes[0]?.id).toBe("a");
});
it("rejects unknown saved sort settings", () => {
  expect(parseNoteSort("constructor")).toBe("title");
  expect(parseNoteSort(null)).toBe("title");
  expect(parseNoteSort("newest")).toBe("newest");
});
