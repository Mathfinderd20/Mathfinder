let unavailable = 0;
const listeners = new Set<() => void>();
export function setCatalogueStatus(count: number) {
  unavailable = count;
  listeners.forEach((listener) => listener());
}
export function catalogueSnapshot() {
  return unavailable;
}
export function subscribeCatalogueStatus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
