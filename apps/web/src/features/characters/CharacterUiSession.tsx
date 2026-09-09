import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";

/** Non-persistent UI state survives cache-generation remounts, but not account changes. */
export class CharacterUiStore {
  private values = new Map<string, unknown>();
  read<T>(characterId: string, key: string, initial: T): T {
    const id = `${characterId}:${key}`;
    return this.values.has(id) ? (this.values.get(id) as T) : initial;
  }
  write<T>(characterId: string, key: string, value: T) {
    this.values.set(`${characterId}:${key}`, value);
  }
}
const Context = createContext<CharacterUiStore | null>(null);
export function CharacterUiSession({ children }: { children: ReactNode }) {
  const store = useRef(new CharacterUiStore());
  return <Context.Provider value={store.current}>{children}</Context.Provider>;
}
export function useCharacterUiState<T>(
  characterId: string,
  key: string,
  initial: T,
) {
  const store = useContext(Context);
  const [value, setValue] = useState<T>(
    () => store?.read(characterId, key, initial) ?? initial,
  );
  const current = useRef(value);
  const update = (next: SetStateAction<T>) => {
    const resolved =
      typeof next === "function"
        ? (next as (previous: T) => T)(current.current)
        : next;
    current.current = resolved;
    store?.write(characterId, key, resolved);
    setValue(resolved);
  };
  return [value, update] as const;
}
