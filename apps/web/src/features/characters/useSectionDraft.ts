import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { useCharacterUiState } from "./CharacterUiSession";
import { SectionDraft } from "./sectionDraft";
import { useCloudConnection } from "../../lib/useCloudConnection";

/** Drafts survive cloud-cache remounts, but remain scoped to this account/character. */
export function useSectionDraft<T>(
  characterId: string,
  key: string,
  load: () => T,
  save: (value: T) => void | boolean,
  autosave: boolean,
) {
  const [stored, remember] = useCharacterUiState<SectionDraft<T> | null>(
    characterId,
    key,
    null,
  );
  const draft = useRef(stored ?? new SectionDraft(load())).current;
  const [value, render] = useState(() => draft.rebase(load()));
  const current = useRef(value);
  const rememberRef = useRef(remember);
  rememberRef.current = remember;
  const cloud = useCloudConnection();
  const callbacks = useRef({ load, save });
  callbacks.current = { load, save };
  const flush = () => {
    if (!draft.dirty) return;
    draft.flush(callbacks.current.load(), callbacks.current.save);
    if (!draft.dirty) {
      current.current = draft.value;
      render(draft.value);
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  const update = useCallback(
    (next: SetStateAction<T>) => {
      const resolved =
        typeof next === "function"
          ? (next as (previous: T) => T)(current.current)
          : next;
      current.current = resolved;
      draft.edit(resolved);
      rememberRef.current(draft);
      render(resolved);
    },
    [draft],
  );
  useEffect(() => {
    if (!autosave) return;
    const timer = window.setTimeout(() => flushRef.current(), 300);
    return () => window.clearTimeout(timer);
  }, [value, autosave]);
  useEffect(() => {
    if (draft.requested) flushRef.current();
  }, [cloud, draft]);
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
  // The cloud's periodic flush should retain the existing Character-tab policy,
  // not commit a secondary editor that the user is still typing in.
  useEffect(() => {
    if (!autosave) return;
    const flush = () => flushRef.current();
    window.addEventListener("mathfinder:flush", flush);
    return () => window.removeEventListener("mathfinder:flush", flush);
  }, [autosave]);
  return [value, update, flush] as const;
}
