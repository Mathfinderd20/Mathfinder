import { describe, expect, it, vi } from "vitest";
import {
  installAssetReloadRecovery,
  markAssetLoadSucceeded,
} from "./assetReloadRecovery";

function setup() {
  const listeners = new Map<string, EventListener>();
  const values = new Map<string, string>();
  const reload = vi.fn();
  const target = {
    addEventListener: (
      name: string,
      listener: EventListenerOrEventListenerObject,
    ) => listeners.set(name, listener as EventListener),
    location: { reload },
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  };
  return { listeners, reload, target, values };
}

describe("stale deployment asset recovery", () => {
  it("reloads once when a Vite chunk no longer exists", () => {
    const { listeners, reload, target } = setup();
    installAssetReloadRecovery(target as never);
    const event = { preventDefault: vi.fn() };
    const listener = listeners.get("vite:preloadError")!;
    listener(event as unknown as Event);
    listener(event as unknown as Event);
    expect(event.preventDefault).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("allows future recovery after the new app loads", () => {
    const { values, target } = setup();
    target.sessionStorage.setItem("mathfinder:stale-assets-reload", "1");
    markAssetLoadSucceeded(target.sessionStorage);
    expect(values.size).toBe(0);
  });
});
