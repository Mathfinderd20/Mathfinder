const RELOAD_MARKER = "mathfinder:stale-assets-reload";

type RecoveryWindow = Pick<
  Window,
  "addEventListener" | "location" | "sessionStorage"
>;
type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function installAssetReloadRecovery(target: RecoveryWindow = window) {
  target.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    if (target.sessionStorage.getItem(RELOAD_MARKER)) return;
    target.sessionStorage.setItem(RELOAD_MARKER, "1");
    target.location.reload();
  });
}

export function markAssetLoadSucceeded(
  storage: RecoveryStorage = sessionStorage,
) {
  storage.removeItem(RELOAD_MARKER);
}
