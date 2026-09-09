import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CharacterNote } from "./characterRepository";
import { useCharacterUiState } from "./CharacterUiSession";
import { useCloudConnection } from "../../lib/useCloudConnection";
import { NoteDraft, noteCategories } from "./noteDraft";
import { CharacterDialog } from "../../components/CharacterDialog";

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
  notes: savedNotes,
  onChange,
  characterId = "local",
  active = true,
}: {
  notes: CharacterNote[];
  onChange: (notes: CharacterNote[]) => void | boolean;
  characterId?: string;
  active?: boolean;
}) {
  const cloud = useCloudConnection();
  const [draft, keepDraft] = useCharacterUiState(
    characterId,
    "note-draft",
    new NoteDraft(),
  );
  const [, renderDraft] = useState(0);
  const latest = useRef({ notes: savedNotes, onChange });
  latest.current = { notes: savedNotes, onChange };
  const notes = draft.view(savedNotes);
  function flush() {
    draft.flush(latest.current.notes, latest.current.onChange);
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    // Retry a requested departure save after a sync lock clears, never while typing.
    draft.retry(latest.current.notes, latest.current.onChange);
  }, [cloud, draft]);
  useEffect(() => {
    if (!active) {
      flushRef.current();
      renderDraft((revision) => revision + 1);
    }
  }, [active]);
  useEffect(() => {
    const leave = () => flushRef.current();
    const hide = () => {
      if (document.visibilityState === "hidden") leave();
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("visibilitychange", hide);
      leave();
    };
  }, []);
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
  const [deleteTarget, setDeleteTarget] = useState<CharacterNote>();
  const [customCategory, setCustomCategory] = useState(false);
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
  const ordered = filterCharacterNotes(notes, search);
  const selected = notes.find((note) => note.id === selectedId) ?? ordered[0];
  function update(patch: Partial<CharacterNote>) {
    if (!selected) return;
    draft.update(selected.id, patch);
    keepDraft(draft);
    setMessage("");
    renderDraft((revision) => revision + 1);
  }
  function add() {
    flush();
    const note: CharacterNote = {
      id: crypto.randomUUID(),
      title: "Untitled note",
      category: "General",
      pinned: false,
      body: "",
    };
    setSelectedId(note.id);
    setCustomCategory(false);
    setSearch("");
    onChange([...notes, note]);
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
              onClick={() => {
                if (note.id !== selected?.id) flush();
                setSelectedId(note.id);
                setCustomCategory(false);
                setMessage("");
              }}
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
                {draft.dirty
                  ? "Draft · saves when you leave this note"
                  : cloud.status === "offline"
                    ? "Saved locally · offline"
                    : "syncing" in cloud && cloud.syncing
                      ? "Saving…"
                      : "All changes saved"}
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
                <select
                  aria-label="Note category"
                  value={customCategory ? "__custom__" : selected.category}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCustomCategory(value === "__custom__");
                    if (value !== "__custom__") update({ category: value });
                  }}
                >
                  {noteCategories(notes).map((name) => (
                    <option key={name} value={name}>
                      {name || "Uncategorized"}
                    </option>
                  ))}
                  <option value="__custom__">Custom…</option>
                </select>
              </label>
              {customCategory && (
                <label>
                  Custom category
                  <input
                    aria-label="Custom category"
                    value={selected.category}
                    onChange={(event) =>
                      update({ category: event.target.value })
                    }
                  />
                </label>
              )}
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
                    const current = draft
                      .view(latest.current.notes)
                      .find((note) => note.id === selected.id);
                    if (!current) return;
                    draft.update(current.id, { body: current.body + text });
                    keepDraft(draft);
                    renderDraft((revision) => revision + 1);
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
              className="notebook-body"
              aria-label="Note body"
              placeholder="Clues, names, plans… this page is yours."
              value={selected.body}
              onChange={(event) => update({ body: event.target.value })}
            />
            <footer>
              <span role="status">
                {message ||
                  "Plain text · saves when you switch notes, tabs, or pages"}
              </span>
              <button
                className="ghost small"
                onClick={() => setDeleteTarget(selected)}
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
      {deleteTarget && (
        <CharacterDialog
          label="Delete note"
          onClose={() => setDeleteTarget(undefined)}
        >
          <section className="modal notebook-delete-dialog">
            <header className="modal-head">
              <h2>Delete note?</h2>
            </header>
            <p>
              Delete “{deleteTarget.title || "Untitled note"}”? This cannot be
              undone.
            </p>
            <div className="modal-actions">
              <button
                className="ghost"
                onClick={() => setDeleteTarget(undefined)}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  draft.remove(deleteTarget.id);
                  keepDraft(draft);
                  const remaining = filterCharacterNotes(
                    draft.view(latest.current.notes),
                    search,
                  );
                  setSelectedId(remaining[0]?.id);
                  setCustomCategory(false);
                  setDeleteTarget(undefined);
                  renderDraft((revision) => revision + 1);
                  flush();
                  setMessage(
                    draft.dirty
                      ? "Deletion queued · waiting to save."
                      : "Note deleted.",
                  );
                }}
              >
                Delete note
              </button>
            </div>
          </section>
        </CharacterDialog>
      )}
    </div>
  );
}
