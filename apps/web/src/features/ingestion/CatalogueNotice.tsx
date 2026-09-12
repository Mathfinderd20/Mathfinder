import { useSyncExternalStore } from "react";
import { catalogueSnapshot, subscribeCatalogueStatus } from "./catalogueStatus";

export function CatalogueNotice() {
  const count = useSyncExternalStore(
    subscribeCatalogueStatus,
    catalogueSnapshot,
    () => 0,
  );
  if (!count) return null;
  return (
    <aside className="connection-banner" role="status">
      Some catalogue records are unavailable pending review. Saved character
      references remain, but rules calculations using unavailable records may be
      incomplete.
    </aside>
  );
}
