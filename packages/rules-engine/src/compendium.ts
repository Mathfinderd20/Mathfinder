export interface CompendiumEntry {
  id: string;
  name: string;
  pack?: string;
  source?: string;
  tags?: string[];
}

export interface CompendiumIndex<T extends CompendiumEntry> {
  readonly all: readonly T[];
  readonly byId: Readonly<Record<string, T>>;
  /** First entry for a normalized name, retained for exact lookup compatibility. */
  readonly byName: Readonly<Record<string, T>>;
  /** Every entry for a normalized name, for catalogs with repeated labels. */
  readonly byNameAll: Readonly<Record<string, readonly T[]>>;
}

const indexCache = new WeakMap<object, CompendiumIndex<CompendiumEntry>>();

function normalizeCompendiumKey(value: string) {
  return value.trim().toLowerCase();
}

export function buildCompendiumIndex<T extends CompendiumEntry>(
  entries: readonly T[],
): CompendiumIndex<T> {
  const byId: Record<string, T> = Object.create(null);
  const byName: Record<string, T> = Object.create(null);
  const byNameAll: Record<string, T[]> = Object.create(null);
  for (const entry of entries) {
    const id = normalizeCompendiumKey(entry.id);
    if (!id) throw new Error("Compendium entries require a non-empty id.");
    if (byId[id]) throw new Error(`Duplicate compendium id "${entry.id}".`);
    byId[id] = entry;

    const name = normalizeCompendiumKey(entry.name);
    if (!name)
      throw new Error(`Compendium entry "${entry.id}" requires a name.`);
    byName[name] ??= entry;
    (byNameAll[name] ??= []).push(entry);
  }
  return {
    all: [...entries],
    byId,
    byName,
    byNameAll,
  };
}

/** Cache an index by its stable source array/registry object. */
export function getCachedCompendiumIndex<T extends CompendiumEntry>(
  source: object,
  entries: () => readonly T[],
): CompendiumIndex<T> {
  const cached = indexCache.get(source);
  if (cached) return cached as CompendiumIndex<T>;
  const index = buildCompendiumIndex(entries());
  indexCache.set(source, index);
  return index;
}

/** Call after intentionally mutating a source object that has been indexed. */
export function invalidateCompendiumIndex(source: object): void {
  indexCache.delete(source);
}

export function getCompendiumEntryById<T extends CompendiumEntry>(
  index: CompendiumIndex<T>,
  id: string,
): T | undefined {
  return index.byId[normalizeCompendiumKey(id)];
}

export function getCompendiumEntryByName<T extends CompendiumEntry>(
  index: CompendiumIndex<T>,
  name: string,
): T | undefined {
  return index.byName[normalizeCompendiumKey(name)];
}

export function getCompendiumEntriesByName<T extends CompendiumEntry>(
  index: CompendiumIndex<T>,
  name: string,
): readonly T[] {
  return index.byNameAll[normalizeCompendiumKey(name)] ?? [];
}

export function searchCompendiumEntries<T extends CompendiumEntry>(
  entriesOrIndex: readonly T[] | CompendiumIndex<T>,
  query: string,
  extraFields: Array<(entry: T) => string | string[] | undefined> = [],
): T[] {
  const entries: readonly T[] = Array.isArray(entriesOrIndex)
    ? entriesOrIndex
    : (entriesOrIndex as CompendiumIndex<T>).all;
  const search = query.trim().toLowerCase();
  if (!search) return [...entries];
  return entries.filter((entry) => {
    const parts = [
      entry.name,
      entry.id,
      entry.pack,
      entry.source,
      ...(entry.tags ?? []),
    ];
    for (const field of extraFields) {
      const value = field(entry);
      if (Array.isArray(value)) parts.push(...value);
      else if (value) parts.push(value);
    }
    return parts.join(" ").toLowerCase().includes(search);
  });
}
