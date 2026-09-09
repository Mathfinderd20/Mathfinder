import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CharacterNote } from "./characterRepository";
import { useCharacterUiState } from "./CharacterUiSession";
import { useCloudConnection } from "../../lib/useCloudConnection";

export function filterCharacterNotes(notes: CharacterNote[], search: string) {
  const query = search.trim().toLowerCase();
  return [...notes]
    .filter((note) =>
      `${note.title} ${note.category} ${note.body}`
        .toLowerCase()
        .includes(query),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title),
    );
}

export function CharacterNotebook({
  notes,
  onChange,
  characterId = "local",
}: {
  notes: CharacterNote[];
  onChange: (notes: CharacterNote[]) => void;
  characterId?: string;
}) {
  const cloud = useCloudConnection();
  const [selectedId, setSelectedId] = useCharacterUiState<string | undefined>(
    characterId,
    "selected-note",
    notes[0]?.id,
  );
  const [search, setSearch] = useCharacterUiState(
    characterId,
    "note-search",
    "",
  );
  const [message, setMessage] = useState("");
  const body = useRef<HTMLTextAreaElement>(null);
  const editor = useRef<HTMLElement>(null);
  const [focus, setFocus] = useCharacterUiState<{
    label: string;
    start: number | null;
    end: number | null;
  } | null>(characterId, "notebook-focus", null);
  const initialFocus = useRef(focus);
  useLayoutEffect(() => {
    const saved = initialFocus.current;
    if (!saved || editor.current?.closest("[hidden]")) return;
    const input = [
      ...(editor.current?.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >("input[aria-label], textarea[aria-label]") ?? []),
    ].find((element) => element.getAttribute("aria-label") === saved.label);
    input?.focus({ preventScroll: true });
    if (input && saved.start !== null && saved.end !== null)
      input.setSelectionRange(saved.start, saved.end);
  }, []);
  const ordered = useMemo(
    () => filterCharacterNotes(notes, search),
    [notes, search],
  );
  const selected = notes.find((note) => note.id === selectedId) ?? ordered[0];
  function update(patch: Partial<CharacterNote>) {
    if (selected)
      onChange(
        notes.map((note) =>
          note.id === selected.id ? { ...note, ...patch } : note,
        ),
      );
  }
  function add() {
    const note: CharacterNote = {
      id: crypto.randomUUID(),
      title: "Untitled note",
      category: "General",
      pinned: false,
      body: "",
    };
    setSelectedId(note.id);
    setSearch("");
    onChange([...notes, note]);
  }
  function format(prefix: string, suffix = "") {
    if (!selected || !body.current) return;
    const start = body.current.selectionStart,
      end = body.current.selectionEnd;
    update({
      body:
        selected.body.slice(0, start) +
        prefix +
        (selected.body.slice(start, end) || "text") +
        suffix +
        selected.body.slice(end),
    });
    body.current.focus();
  }
  return (
    <div className="workspace-v2 notebook-workspace">
      <aside className="notebook-index v2-panel" aria-label="Player notes">
        <header>
          <span className="character-eyebrow">My character notes</span>
          <h2>
            Notes <small>{notes.length}</small>
          </h2>
          <button onClick={add}>+ New note</button>
        </header>
        <input
          type="search"
          aria-label="Search notes"
          placeholder="Search notes…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="notebook-list">
          {ordered.map((note) => (
            <button
              key={note.id}
              className={selected?.id === note.id ? "active" : ""}
              onClick={() => setSelectedId(note.id)}
            >
              <span>
                {note.pinned ? "◆ Pinned · " : ""}
                {note.category}
              </span>
              <strong>{note.title || "Untitled note"}</strong>
              <small>{note.body.slice(0, 90) || "Empty note"}</small>
            </button>
          ))}
          {!ordered.length && (
            <p className="v2-empty">
              {notes.length
                ? "No notes match your search."
                : "Your next adventure starts with a blank page."}
            </p>
          )}
        </div>
        <p className="notebook-privacy">
          Private to you. Campaign GMs cannot access these notes.
        </p>
      </aside>
      <section
        ref={editor}
        className="notebook-editor v2-panel"
        onSelect={(event) => {
          const input = event.target;
          if (
            input instanceof HTMLInputElement ||
            input instanceof HTMLTextAreaElement
          )
            setFocus({
              label: input.getAttribute("aria-label") ?? "",
              start: input.selectionStart,
              end: input.selectionEnd,
            });
        }}
        onBlur={() => setFocus(null)}
      >
        {selected ? (
          <>
            <header>
              <span className="notebook-save">
                Private ·{" "}
                {cloud.status === "offline"
                  ? "Saved locally · offline"
                  : "syncing" in cloud && cloud.syncing
                    ? "Saving…"
                    : "Autosave enabled"}
              </span>
              <button
                className="ghost small"
                onClick={() => update({ pinned: !selected.pinned })}
              >
                {selected.pinned ? "◆ Pinned" : "Pin note"}
              </button>
            </header>
            <input
              className="notebook-title"
              aria-label="Note title"
              value={selected.title}
              onChange={(event) => update({ title: event.target.value })}
            />
            <div className="notebook-toolbar">
              <label>
                Category
                <input
                  aria-label="Note category"
                  list="notebook-categories"
                  value={selected.category}
                  onChange={(event) => update({ category: event.target.value })}
                />
              </label>
              <datalist id="notebook-categories">
                {["Session", "Location", "Character", "Plot", "General"].map(
                  (name) => (
                    <option key={name}>{name}</option>
                  ),
                )}
              </datalist>
              <button aria-label="Bold text" onClick={() => format("**", "**")}>
                <b>B</b>
              </button>
              <button aria-label="Italic text" onClick={() => format("*", "*")}>
                <i>I</i>
              </button>
              <button onClick={() => format("\n- ")}>List</button>
              <button onClick={() => format("[", "](https://)")}>Link</button>
              <span className="v2-spacer" />
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(selected.body);
                    setMessage("Note copied.");
                  } catch {
                    setMessage(
                      "Clipboard unavailable. Select text and copy manually.",
                    );
                  }
                }}
              >
                Copy
              </button>
              <button
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    update({ body: selected.body + text });
                    setMessage("Pasted into note.");
                  } catch {
                    setMessage("Paste into the editor with Ctrl+V.");
                  }
                }}
              >
                Paste
              </button>
            </div>
            <textarea
              ref={body}
              className="notebook-body"
              aria-label="Note body"
              placeholder="Clues, names, plans… this page is yours."
              value={selected.body}
              onChange={(event) => update({ body: event.target.value })}
            />
            <footer>
              <span role="status">
                {message ||
                  "Plain text with Markdown shortcuts · changes save automatically"}
              </span>
              <button
                className="ghost small"
                onClick={() => {
                  if (window.confirm(`Delete “${selected.title}”?`)) {
                    onChange(notes.filter((note) => note.id !== selected.id));
                    setSelectedId(undefined);
                  }
                }}
              >
                Delete note
              </button>
            </footer>
          </>
        ) : (
          <div className="v2-empty">
            <span className="character-eyebrow">Player-only journal</span>
            <h2>Keep the clue to yourself.</h2>
            <p>Choose a note from the left, or create a new one.</p>
            <button onClick={add}>Create first note</button>
          </div>
        )}
      </section>
    </div>
  );
}
