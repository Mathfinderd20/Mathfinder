import { useMemo, useState } from "react";
import type { CharacterNote } from "./characterRepository";

interface Props {
  notes: CharacterNote[];
  onChange: (notes: CharacterNote[]) => void;
}

function newNote(): CharacterNote {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `note-${Date.now()}`,
    title: "Untitled note",
    category: "General",
    pinned: false,
    body: "",
  };
}

export function CharacterNotes({ notes, onChange }: Props) {
  const [selectedId, setSelectedId] = useState(notes[0]?.id);
  const ordered = useMemo(
    () =>
      [...notes].sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title),
      ),
    [notes],
  );
  const selected = notes.find((note) => note.id === selectedId) ?? ordered[0];

  function update(patch: Partial<CharacterNote>) {
    if (!selected) return;
    onChange(
      notes.map((note) =>
        note.id === selected.id ? { ...note, ...patch } : note,
      ),
    );
  }

  function add() {
    const note = newNote();
    onChange([note, ...notes]);
    setSelectedId(note.id);
  }

  return (
    <div className="character-notes-workspace">
      <aside className="character-note-list" aria-label="Player notes">
        <div className="character-note-list-head">
          <div>
            <span className="character-eyebrow">Private</span>
            <h2>My notes</h2>
          </div>
          <button type="button" className="ghost small" onClick={add}>
            + Note
          </button>
        </div>
        {ordered.length ? (
          ordered.map((note) => (
            <button
              type="button"
              className={
                note.id === selected?.id
                  ? "character-note-card active"
                  : "character-note-card"
              }
              key={note.id}
              onClick={() => setSelectedId(note.id)}
            >
              <span>
                {note.pinned ? "◆ " : ""}
                {note.category}
              </span>
              <strong>{note.title}</strong>
              <small>{note.body.slice(0, 90) || "Empty note"}</small>
            </button>
          ))
        ) : (
          <p className="hint character-note-empty">
            Your notes are private to this character. Add one when the adventure
            gives you something worth remembering.
          </p>
        )}
      </aside>
      <section className="character-note-editor panel">
        {selected ? (
          <>
            <div className="character-note-editor-head">
              <label className="field compact">
                <span>Title</span>
                <input
                  value={selected.title}
                  onChange={(event) => update({ title: event.target.value })}
                />
              </label>
              <label className="field compact">
                <span>Category</span>
                <input
                  value={selected.category}
                  onChange={(event) => update({ category: event.target.value })}
                />
              </label>
              <label className="character-note-pin">
                <input
                  type="checkbox"
                  checked={selected.pinned}
                  onChange={(event) => update({ pinned: event.target.checked })}
                />
                Pin
              </label>
              <button
                type="button"
                className="ghost small"
                onClick={() => {
                  const next = notes.filter((note) => note.id !== selected.id);
                  onChange(next);
                  setSelectedId(next[0]?.id);
                }}
              >
                Delete
              </button>
            </div>
            <textarea
              aria-label="Note body"
              className="character-note-body"
              value={selected.body}
              placeholder="Write anything the GM should not automatically see…"
              onChange={(event) => update({ body: event.target.value })}
            />
          </>
        ) : (
          <div className="character-note-welcome">
            <span className="character-eyebrow">Player-only journal</span>
            <h2>Keep the clue to yourself.</h2>
            <p>Choose a note from the left, or create a new one.</p>
            <button type="button" onClick={add}>
              Create first note
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
