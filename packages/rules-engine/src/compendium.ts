export interface CompendiumEntry {
  id: string;
  name: string;
  pack?: string;
  source?: string;
  tags?: string[];
}

export interface CompendiumIndex<T extends CompendiumEntry> {
  all: T[];
  byId: Record<string, T>;
  byName: Record<string, T>;
}

function normalizeCompendiumName(name: string) {
  return name.trim().toLowerCase();
}

export function buildCompendiumIndex<T extends CompendiumEntry>(
  entries: T[],
): CompendiumIndex<T> {
  return {
    all: [...entries],
    byId: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
    byName: Object.fromEntries(
      entries.map((entry) => [normalizeCompendiumName(entry.name), entry]),
    ),
  };
}

export function getCompendiumEntryById<T extends CompendiumEntry>(
  index: CompendiumIndex<T>,
  id: string,
): T | undefined {
  return index.byId[id];
}

export function getCompendiumEntryByName<T extends CompendiumEntry>(
  index: CompendiumIndex<T>,
  name: string,
): T | undefined {
  return index.byName[normalizeCompendiumName(name)];
}

export function searchCompendiumEntries<T extends CompendiumEntry>(
  entries: T[],
  query: string,
  extraFields: Array<(entry: T) => string | string[] | undefined> = [],
): T[] {
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
