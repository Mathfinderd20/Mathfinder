function equal(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Reapply edited fields onto the latest record; lists are atomic choices. */
export function mergeSectionDraft<T>(base: T, draft: T, latest: T): T {
  if (equal(base, draft)) return latest;
  if (
    base &&
    draft &&
    latest &&
    typeof base === "object" &&
    typeof draft === "object" &&
    typeof latest === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(draft) &&
    !Array.isArray(latest)
  ) {
    const before = base as Record<string, unknown>;
    const edited = draft as Record<string, unknown>;
    const result = { ...latest } as Record<string, unknown>;
    for (const key of new Set([
      ...Object.keys(before),
      ...Object.keys(edited),
    ])) {
      if (equal(before[key], edited[key])) continue;
      if (!(key in edited)) delete result[key];
      else
        result[key] = mergeSectionDraft(before[key], edited[key], result[key]);
    }
    return result as T;
  }
  return draft;
}

export class SectionDraft<T> {
  private base: T;
  value: T;
  requested = false;
  constructor(initial: T) {
    this.base = initial;
    this.value = initial;
  }
  get dirty() {
    return !equal(this.base, this.value);
  }
  edit(value: T) {
    this.value = value;
  }
  rebase(latest: T) {
    this.value = mergeSectionDraft(this.base, this.value, latest);
    this.base = latest;
    return this.value;
  }
  flush(latest: T, save: (value: T) => void | boolean) {
    this.requested = this.dirty;
    if (!this.dirty) return;
    const next = mergeSectionDraft(this.base, this.value, latest);
    if (save(next) === false) return;
    this.base = next;
    this.value = next;
    this.requested = false;
  }
}
