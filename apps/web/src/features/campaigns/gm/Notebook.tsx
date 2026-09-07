import { useState } from "react";
import type { Note } from "./mockData";

export function Notebook({
  notes,
  setNotes,
}: {
  notes: Note[];
  setNotes: (notes: Note[]) => void;
}) {
  const [selected, setSelected] = useState(notes[0]?.id);
  const [search, setSearch] = useState("");
  const note = notes.find((entry) => entry.id === selected);
  function update(patch: Partial<Note>) {
    setNotes(
      notes.map((entry) =>
        entry.id === selected ? { ...entry, ...patch } : entry,
      ),
    );
  }
  return (
    <div className="gm-workspace">
      <section className="gm-sheet gm-notebook">
        <div className="gm-sheet-top">
          <span className="gm-kicker">Campaign notebook</span>
          <span className="gm-save">◈ Private to the campaign creator</span>
        </div>
        {note ? (
          <>
            <input
              className="gm-note-title"
              aria-label="Note title"
              value={note.title}
              onChange={(e) => update({ title: e.target.value })}
            />
            <div className="gm-actions">
              <label>
                Category
                <select
                  value={note.category}
                  onChange={(e) => update({ category: e.target.value })}
                >
                  {["Session", "Location", "Character", "Plot", "General"].map(
                    (category) => (
                      <option key={category}>{category}</option>
                    ),
                  )}
                </select>
              </label>
              <button onClick={() => update({ pinned: !note.pinned })}>
                {note.pinned ? "Unpin note" : "Pin note"}
              </button>
              <button
                onClick={() => {
                  const copy = {
                    ...note,
                    id: crypto.randomUUID(),
                    title: `${note.title} · Copy`,
                  };
                  setNotes([...notes, copy]);
                  setSelected(copy.id);
                }}
              >
                Duplicate
              </button>
            </div>
            <textarea
              className="gm-note-body"
              aria-label="Note body"
              value={note.body}
              onChange={(e) => update({ body: e.target.value })}
            />
            <button
              className="gm-danger"
              onClick={() => {
                if (window.confirm("Remove this campaign note?")) {
                  setNotes(notes.filter((entry) => entry.id !== note.id));
                  setSelected(notes.find((entry) => entry.id !== note.id)?.id);
                }
              }}
            >
              Delete note
            </button>
          </>
        ) : (
          <div className="gm-empty">
            <h2>A little room to plot.</h2>
            <p>Select a note or start a new one.</p>
          </div>
        )}
      </section>
      <aside className="gm-rail">
        <div className="gm-rail-head">
          <span className="gm-kicker">Your story, organized</span>
          <h3>
            Campaign notes <small>{notes.length}</small>
          </h3>
          <button
            className="gm-primary"
            onClick={() => {
              const next = {
                id: crypto.randomUUID(),
                title: "Untitled note",
                body: "",
                category: "General",
                pinned: false,
              };
              setNotes([...notes, next]);
              setSelected(next.id);
            }}
          >
            + New note
          </button>
          <input
            aria-label="Search notes"
            placeholder="Search your notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {[...notes]
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
          .filter((entry) =>
            `${entry.title} ${entry.body}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((entry) => (
            <button
              className={`gm-list-entry ${entry.id === selected ? "is-selected" : ""}`}
              key={entry.id}
              onClick={() => setSelected(entry.id)}
            >
              <span className="gm-kicker">
                {entry.pinned ? "◆ Pinned · " : ""}
                {entry.category}
              </span>
              <strong>{entry.title}</strong>
              <small>{entry.body.slice(0, 65)}…</small>
            </button>
          ))}
        <p className="gm-rail-foot">
          Your secrets stay behind the screen. Sharing and handouts are not
          available.
        </p>
      </aside>
    </div>
  );
}
