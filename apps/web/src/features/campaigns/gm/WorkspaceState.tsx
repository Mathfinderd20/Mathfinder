import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export type WorkspaceState = Record<string, unknown>;
export const WorkspaceContext = createContext<{
  state: WorkspaceState;
  setState: Dispatch<SetStateAction<WorkspaceState>>;
} | null>(null);

// Preview components keep local state; live components share a saved campaign document.
export function useWorkspaceField<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const context = useContext(WorkspaceContext);
  const [local, setLocal] = useState(initial);
  if (!context) return [local, setLocal];
  const value = (context.state[key] ?? local) as T;
  const setValue: Dispatch<SetStateAction<T>> = (next) => {
    context.setState((previous) => ({
      ...previous,
      [key]:
        typeof next === "function"
          ? (next as (value: T) => T)((previous[key] ?? local) as T)
          : next,
    }));
  };
  return [value, setValue];
}
