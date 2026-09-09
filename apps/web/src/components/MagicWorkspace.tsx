import { useMemo, useState } from "react";
import {
  spellSaveDcForSchool,
  type DerivedSpellcasting,
} from "@mathfinder/rules-engine";
import {
  SpellcastingManager,
  type SpellcastingManagerProps,
} from "./SpellcastingManager";
import { CharacterDialog } from "./CharacterDialog";
import { useCharacterUiState } from "../features/characters/CharacterUiSession";
import { buildSpellCompendiumOptions } from "../spellOptionData";
import { spellTitle } from "../rulesText";
import { displaySpellName, displayDomainNames } from "../spellLabels";
import { sign } from "../util";
import { Tooltip } from "./Tooltip";

const normalized = (name: string) => name.trim().toLowerCase();
const unique = (names: string[]) => [...new Set(names.filter(Boolean))];
export const primarySpellSchool = (school: string | undefined) =>
  school
    ?.trim()
    .toLowerCase()
    .match(/^[a-z]+/)?.[0] ?? "";
export const spellRowSaveDc = (
  caster: DerivedSpellcasting,
  level: number,
  school: string | undefined,
) => spellSaveDcForSchool(caster, level, primarySpellSchool(school));
export function compactSpellComponents(components: string | undefined) {
  return (
    components
      ?.split(/,(?![^()]*\))/)
      .map(
        (value) => value.trim().match(/^(V|S|M|F|DF)\b/)?.[0] ?? value.trim(),
      )
      .join(", ") || "—"
  );
}
export function spellPreparationRoom(
  caster: DerivedSpellcasting,
  level: number,
) {
  const diag = caster.selectionDiagnostics[level];
  const current = caster.selectedPreparedSpells[level] ?? [];
  const restricted = diag?.restrictedSlotCapacity ?? 0;
  const eligible = diag?.restrictedSlotEligibleSpellNames.map(normalized) ?? [];
  const assigned = Math.min(
    restricted,
    current.filter((name) => eligible.includes(normalized(name))).length,
  );
  return {
    total: Math.max(0, (diag?.capacity ?? 0) - current.length),
    restricted: Math.max(0, restricted - assigned),
    normal: Math.max(
      0,
      (diag?.capacity ?? 0) - restricted - (current.length - assigned),
    ),
  };
}
export function canReplacePreparation(
  caster: DerivedSpellcasting,
  level: number,
  index: number,
  replacement: string,
) {
  const current = caster.selectedPreparedSpells[level] ?? [];
  if (index < 0 || index >= current.length || !replacement.trim()) return false;
  const known = [
    ...(caster.librarySpells[level] ?? []),
    ...(caster.grantedSpells[level] ?? []),
  ];
  if (
    !caster.selectionDiagnostics[level]?.canCastLevel ||
    !known.some((name) => normalized(name) === normalized(replacement))
  )
    return false;
  const eligible =
    caster.selectionDiagnostics[level]?.restrictedSlotEligibleSpellNames.map(
      normalized,
    ) ?? [];
  const before = current.filter((name) =>
    eligible.includes(normalized(name)),
  ).length;
  const after = current
    .map((name, i) => (i === index ? replacement : name))
    .filter((name) => eligible.includes(normalized(name))).length;
  return (
    after >=
    Math.min(
      before,
      caster.selectionDiagnostics[level]?.restrictedSlotCapacity ?? 0,
    )
  );
}

type Preparation = { name: string; level: number; index?: number };
export function MagicWorkspace(
  props: SpellcastingManagerProps & {
    characterId?: string;
    onAddSource?: () => void;
  },
) {
  const { casters, characterId = "local" } = props;
  const [source, setSource] = useCharacterUiState(
    characterId,
    "magic-source",
    casters[0]?.className ?? "",
  );
  const [view, setView] = useCharacterUiState<"ready" | "library">(
    characterId,
    "magic-view",
    "ready",
  );
  const [railOpen, setRailOpen] = useCharacterUiState(
    characterId,
    "magic-rail",
    true,
  );
  const [query, setQuery] = useCharacterUiState(characterId, "magic-query", "");
  const [levelFilter, setLevelFilter] = useCharacterUiState(
    characterId,
    "magic-level",
    "",
  );
  const [school, setSchool] = useState("");
  const [sort, setSort] = useState("level");
  const [manage, setManage] = useCharacterUiState(
    characterId,
    "magic-manage",
    false,
  );
  const [detail, setDetail] = useState<string>();
  const [preparation, setPreparation] = useState<Preparation>();
  const [quantity, setQuantity] = useState(1);
  const [replacement, setReplacement] = useState("");
  const [replaceSearch, setReplaceSearch] = useState("");
  const [page, setPage] = useState(0);
  const caster =
    casters.find((value) => value.className === source) ?? casters[0];
  const key = caster?.className.toLowerCase() ?? "";
  const prepared = caster?.castingType === "prepared";
  const selections = caster
    ? prepared
      ? caster.selectedPreparedSpells
      : caster.selectedKnownSpells
    : {};
  const levels = caster
    ? Object.keys(caster.selectionDiagnostics)
        .map(Number)
        .filter(
          (level) =>
            (caster.selectionDiagnostics[level]?.capacity ?? 0) > 0 ||
            (selections[level]?.length ?? 0) > 0 ||
            (caster.librarySpells[level]?.length ?? 0) > 0 ||
            (caster.grantedSpells[level]?.length ?? 0) > 0,
        )
        .sort((a, b) => a - b)
    : [];
  const allOptions = useMemo(
    () => buildSpellCompendiumOptions(props.spellOptions),
    [props.spellOptions],
  );
  const options = allOptions.filter(
    (option) => !caster || option.classLevels[key]?.length,
  );
  const optionMap = new Map(
    allOptions.map((option) => [normalized(option.name), option]),
  );
  const detailSpell = detail
    ? optionMap.get(normalized(detail))?.spell
    : undefined;
  const saveDcs = Object.values(caster?.spellSaveDcs ?? {}).filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  const restrictedLabel = caster?.domains.length
    ? "Domain"
    : caster?.specialistSchool
      ? "Specialist"
      : "Restricted";
  const catalog = options
    .filter(
      (option) =>
        (!query || option.searchBlob.includes(query.toLowerCase())) &&
        (!school || primarySpellSchool(option.schoolTag) === school) &&
        (!levelFilter ||
          option.classLevels[key]?.includes(Number(levelFilter))),
    )
    .sort((a, b) => {
      const rank = (name: string) =>
        query && name.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
      return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
    });
  const pages = Math.max(1, Math.ceil(catalog.length / 25)),
    currentPage = Math.min(page, pages - 1);
  const rows = levels
    .flatMap((level) => {
      const selected = selections[level] ?? [],
        library = caster?.librarySpells[level] ?? [];
      const names =
        view === "ready"
          ? unique(selected)
          : unique([
              ...library,
              ...selected,
              ...(caster?.grantedSpells[level] ?? []),
            ]);
      return names.map((name) => ({
        name,
        level,
        copies: selected.filter(
          (value) => normalized(value) === normalized(name),
        ).length,
        option: optionMap.get(normalized(name)),
        domain: (
          caster?.selectionDiagnostics[level]
            ?.restrictedSlotEligibleSpellNames ?? []
        ).some((value) => normalized(value) === normalized(name)),
      }));
    })
    .filter(
      (row) =>
        (!levelFilter || row.level === Number(levelFilter)) &&
        (!query ||
          `${row.name} ${row.option?.searchBlob ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (!school || primarySpellSchool(row.option?.schoolTag) === school),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "source"
          ? (a.option?.sourceTag ?? "").localeCompare(b.option?.sourceTag ?? "")
          : a.level - b.level || a.name.localeCompare(b.name),
    );
  function openPreparation(name: string, level: number, index?: number) {
    setPreparation({ name, level, index });
    setReplacement("");
    setReplaceSearch("");
    setQuantity(1);
  }
  const replacementNames =
    caster && preparation
      ? unique([
          ...(caster.librarySpells[preparation.level] ?? []),
          ...(caster.grantedSpells[preparation.level] ?? []),
        ]).filter(
          (name) =>
            name !== preparation.name &&
            name.toLowerCase().includes(replaceSearch.toLowerCase()) &&
            canReplacePreparation(
              caster,
              preparation.level,
              preparation.index ?? -1,
              name,
            ),
        )
      : [];
  const room =
    caster && preparation
      ? spellPreparationRoom(caster, preparation.level)
      : { total: 0, restricted: 0, normal: 0 };
  const isRestricted =
    caster && preparation
      ? (
          caster.selectionDiagnostics[preparation.level]
            ?.restrictedSlotEligibleSpellNames ?? []
        ).some((name) => normalized(name) === normalized(preparation.name))
      : false;
  const availableCopies = isRestricted
    ? room.total
    : Math.min(room.total, room.normal);
  return (
    <div
      className={`workspace-v2 magic-v2 v2-rail-layout ${railOpen ? "" : "is-collapsed"}`}
    >
      <main className="v2-main">
        <div
          className="casting-source-tabs"
          role="tablist"
          aria-label="Casting source"
        >
          {casters.map((entry) => (
            <button
              key={entry.className}
              role="tab"
              aria-selected={caster?.className === entry.className}
              onClick={() => {
                setSource(entry.className);
                setLevelFilter("");
                setQuery("");
                setSchool("");
                setView("ready");
              }}
            >
              <small>{entry.castingType}</small>
              <strong>
                {entry.className} {entry.casterLevel}
              </strong>
              <span>
                {Object.entries(entry.slotsRemaining).reduce<number>(
                  (sum, [level, n]) =>
                    sum +
                    (entry.selectionDiagnostics[Number(level)]?.isAtWill
                      ? 0
                      : (n ?? 0)),
                  0,
                )}{" "}
                slots ready
              </span>
            </button>
          ))}
          {props.onAddSource && (
            <button className="casting-add-source" onClick={props.onAddSource}>
              + Add source in Build
            </button>
          )}
        </div>
        {caster ? (
          <>
            <section className="v2-panel casting-source-summary">
              <div>
                <span className="character-eyebrow">
                  Selected casting source
                </span>
                <h2>{caster.className}</h2>
                <p>
                  {prepared ? "Prepared" : "Spontaneous"} ·{" "}
                  {caster.castingAbility.toUpperCase()}{" "}
                  {caster.castingAbilityScore}
                  {caster.domains.length
                    ? ` · ${displayDomainNames(caster.domains).join(" / ")}`
                    : ""}
                </p>
              </div>
              <div>
                <small>Caster level</small>
                <strong>{caster.casterLevel}</strong>
              </div>
              <div>
                <small>Concentration</small>
                <Tooltip
                  trigger="click"
                  content={caster.concentration.breakdown
                    .map((entry) => `${entry.source}: ${sign(entry.value)}`)
                    .join("\n")}
                >
                  <strong>{sign(caster.concentration.total)}</strong>
                </Tooltip>
              </div>
              <div>
                <small>Base save DCs</small>
                <strong>
                  {saveDcs.length
                    ? `${Math.min(...saveDcs)}–${Math.max(...saveDcs)}`
                    : "—"}
                </strong>
              </div>
              <button className="ghost small" onClick={() => setManage(true)}>
                Manage source
              </button>
            </section>
            <section className="v2-panel casting-slot-ledger">
              <header className="v2-panel-heading">
                <h2>Daily magic</h2>
                <small>Prepared · available · spent</small>
              </header>
              <div className="casting-level-ledger">
                {levels.map((level) => {
                  const diag = caster.selectionDiagnostics[level];
                  return (
                    <button
                      key={level}
                      className={levelFilter === String(level) ? "active" : ""}
                      onClick={() =>
                        setLevelFilter(
                          levelFilter === String(level) ? "" : String(level),
                        )
                      }
                    >
                      <span>Level {level}</span>
                      <strong>
                        {diag?.isAtWill
                          ? "At will"
                          : `${caster.slotsRemaining[level] ?? 0} / ${caster.spellsPerDay[level] ?? 0}`}
                      </strong>
                      <small>
                        {(selections[level] ?? []).length}{" "}
                        {prepared ? "prepared" : "known"} ·{" "}
                        {caster.slotsUsed[level] ?? 0} spent
                      </small>
                      {(diag?.restrictedSlotCapacity ?? 0) > 0 && (
                        <em>
                          {diag?.restrictedSlotCapacity} domain / restricted
                        </em>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="v2-panel casting-spell-panel">
              <header className="v2-panel-heading">
                <div className="v2-segmented">
                  <button
                    aria-pressed={view === "ready"}
                    onClick={() => setView("ready")}
                  >
                    {prepared ? "Spells prepared" : "Available to cast"}
                  </button>
                  <button
                    aria-pressed={view === "library"}
                    onClick={() => setView("library")}
                  >
                    Spell library
                  </button>
                </div>
                <small>
                  {rows.length} spells ·{" "}
                  <span className="spell-domain-badge">{restrictedLabel}</span>{" "}
                  reserved choices
                </small>
              </header>
              <div className="casting-spell-table">
                <div className="casting-spell-head">
                  <span>Level</span>
                  <span>Spell & description</span>
                  <span>Save DC</span>
                  <span>Components</span>
                  <span>{view === "ready" ? "Ready" : "Prepared"}</span>
                  <span>Actions</span>
                </div>
                {rows.map((row) => {
                  const diag = caster.selectionDiagnostics[row.level];
                  const atWill = !!diag?.isAtWill;
                  const cast =
                    props.spellCastCounts[key]?.[row.level]?.[row.name] ?? 0;
                  const remaining = caster.slotsRemaining[row.level] ?? 0;
                  const ready = prepared
                    ? Math.max(0, row.copies - cast)
                    : remaining;
                  const dc = spellRowSaveDc(
                    caster,
                    row.level,
                    row.option?.schoolTag,
                  );
                  const firstIndex = (selections[row.level] ?? []).findIndex(
                    (name) => name === row.name,
                  );
                  const components = row.option?.spell?.components;
                  return (
                    <div
                      className="casting-spell-row"
                      key={`${row.level}-${row.name}`}
                    >
                      <span className="spell-level-number">{row.level}</span>
                      <button
                        className="casting-spell-name"
                        aria-label={`Open ${row.name} spell description`}
                        onClick={() => setDetail(row.name)}
                      >
                        <strong>
                          {row.name}{" "}
                          {row.domain && (
                            <small className="spell-domain-badge">
                              {restrictedLabel}
                            </small>
                          )}
                        </strong>
                        <span>
                          {row.option?.spell?.description ||
                            "Open full spell details"}
                        </span>
                        <small>
                          {row.option?.schoolTag} ·{" "}
                          {row.option?.sourceTag || caster.className}
                        </small>
                      </button>
                      <Tooltip
                        trigger="click"
                        content={
                          dc === undefined
                            ? undefined
                            : `Base DC (level ${row.level}): ${caster.spellSaveDcs[row.level]}\nSchool bonus: ${sign(dc - (caster.spellSaveDcs[row.level] ?? 0))}\nTotal: ${dc}`
                        }
                      >
                        <span>{dc ?? "—"}</span>
                      </Tooltip>
                      <span className="spell-components">
                        <span
                          title={
                            components ||
                            "Components not supplied by this content pack"
                          }
                        >
                          {compactSpellComponents(components)}
                        </span>
                      </span>
                      <span>
                        {view === "library"
                          ? `${row.copies} copies`
                          : atWill
                            ? "At will"
                            : `${ready} / ${prepared ? row.copies : (caster.spellsPerDay[row.level] ?? 0)}`}
                      </span>
                      <div className="casting-spell-actions">
                        {view === "library" && prepared ? (
                          <button
                            className="ghost small"
                            disabled={
                              !diag?.canCastLevel ||
                              !spellPreparationRoom(caster, row.level).total
                            }
                            onClick={() => openPreparation(row.name, row.level)}
                          >
                            Prepare
                          </button>
                        ) : (
                          <button
                            className="ghost small"
                            disabled={
                              !diag?.canCastLevel ||
                              row.copies === 0 ||
                              (!atWill && (remaining <= 0 || ready <= 0))
                            }
                            onClick={() =>
                              props.onCastSpell(
                                key,
                                row.level,
                                caster.spellsPerDay[row.level] ?? 0,
                                row.name,
                                remaining,
                              )
                            }
                          >
                            Cast
                          </button>
                        )}
                        {prepared && row.copies > 0 && (
                          <button
                            className="ghost small"
                            disabled={!atWill && ready <= 0}
                            onClick={() =>
                              openPreparation(row.name, row.level, firstIndex)
                            }
                          >
                            Reprepare
                          </button>
                        )}
                        {!prepared && view === "library" && !row.copies && (
                          <button
                            className="ghost small"
                            disabled={
                              !diag?.canCastLevel ||
                              (selections[row.level] ?? []).length >=
                                (diag?.capacity ?? 0)
                            }
                            onClick={() =>
                              props.onAppendSelection(
                                key,
                                "known",
                                row.level,
                                row.name,
                              )
                            }
                          >
                            Learn
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!rows.length && (
                  <div className="v2-empty">
                    <h3>
                      {view === "ready"
                        ? "Your next spell starts in the library."
                        : "Build your spell library."}
                    </h3>
                    <p>
                      {view === "ready"
                        ? "Choose spells in the library, then prepare or learn them for this source."
                        : "Search the right rail to add spells. Each source keeps its own list and slots."}
                    </p>
                    <button
                      className="ghost"
                      onClick={() => {
                        setView("library");
                        setRailOpen(true);
                      }}
                    >
                      Open library
                    </button>
                  </div>
                )}
              </div>
            </section>
            <p className="v2-footnote">
              Casting uses the existing target-selection flow. Saves and effects
              are resolved by the affected characters or GM; no battle map is
              required.
            </p>
          </>
        ) : (
          <section className="v2-panel v2-empty">
            <span className="character-eyebrow">Always available</span>
            <h2>A place for every kind of magic.</h2>
            <p>
              No casting source is configured yet. Add class levels or supported
              granted magic in Build; your spells and resources will appear
              here.
            </p>
            {props.onAddSource && (
              <button onClick={props.onAddSource}>Open Build</button>
            )}
          </section>
        )}
      </main>
      <aside className="v2-search-rail" aria-label="Magic search">
        <header>
          <div>
            {railOpen && (
              <>
                <span className="character-eyebrow">Discover & prepare</span>
                <h2>Magic</h2>
              </>
            )}
          </div>
          <button
            className="ghost"
            aria-label={
              railOpen ? "Collapse magic search" : "Expand magic search"
            }
            aria-expanded={railOpen}
            onClick={() => setRailOpen(!railOpen)}
          >
            {railOpen ? "›" : "‹"}
          </button>
        </header>
        {railOpen && (
          <>
            <label>
              Search spells
              <input
                type="search"
                aria-label="Search spells"
                placeholder="Name, school, description…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Spell level
              <select
                value={levelFilter}
                onChange={(event) => {
                  setLevelFilter(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">All levels</option>
                {levels.map((level) => (
                  <option key={level} value={level}>
                    Level {level}
                  </option>
                ))}
              </select>
            </label>
            <label>
              School
              <select
                value={school}
                onChange={(event) => {
                  setSchool(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">All schools</option>
                {unique(
                  options.map((option) => primarySpellSchool(option.schoolTag)),
                )
                  .sort()
                  .map((name) => (
                    <option key={name}>{name}</option>
                  ))}
              </select>
            </label>
            <label>
              Sort sheet
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="level">Level, then name</option>
                <option value="name">Name</option>
                <option value="source">Source</option>
              </select>
            </label>
            <button
              className="ghost small"
              onClick={() => {
                setQuery("");
                setLevelFilter("");
                setSchool("");
              }}
            >
              Reset filters
            </button>
            <span className="character-eyebrow">
              {caster?.className ?? "Spell"} catalog · {catalog.length}
            </span>
            <div className="v2-catalog-results">
              {catalog
                .slice(currentPage * 25, (currentPage + 1) * 25)
                .map((option) => {
                  const level = option.classLevels[key]?.[0];
                  const added =
                    level !== undefined &&
                    (caster?.librarySpells[level] ?? []).some(
                      (name) => normalized(name) === normalized(option.name),
                    );
                  return (
                    <article key={option.id}>
                      <button
                        className="v2-text-button"
                        onClick={() => setDetail(option.name)}
                      >
                        <strong>{option.name}</strong>
                      </button>
                      <small>
                        {level === undefined ? "Reference" : `Level ${level}`} ·{" "}
                        {option.schoolTag}
                      </small>
                      <p>{option.spell?.description || option.metaTag}</p>
                      {caster && level !== undefined && (
                        <button
                          className="ghost small"
                          disabled={added}
                          onClick={() =>
                            props.onAppendLibraryEntry(key, level, option.name)
                          }
                        >
                          {added ? "In library" : "+ Add to library"}
                        </button>
                      )}
                    </article>
                  );
                })}
            </div>
            <div className="v2-pagination">
              <button
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                ‹
              </button>
              <small>
                {currentPage + 1} / {pages}
              </small>
              <button
                disabled={currentPage >= pages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                ›
              </button>
            </div>
          </>
        )}
      </aside>
      {manage && caster && (
        <CharacterDialog
          label="Manage casting source"
          onClose={() => setManage(false)}
        >
          <section className="modal v2-editor-dialog">
            <header className="modal-head">
              <h2>{caster.className} · source settings</h2>
              <button onClick={() => setManage(false)} className="ghost">
                Done
              </button>
            </header>
            <p className="hint">
              Domains, schools, restricted slots, suggestions, custom spell
              entries, and runtime adjustments remain available here.
            </p>
            <SpellcastingManager
              {...props}
              casters={[caster]}
              defaultOpen
              onCastSpell={(...args) => {
                setManage(false);
                props.onCastSpell(...args);
              }}
            />
          </section>
        </CharacterDialog>
      )}
      {detail && (
        <CharacterDialog
          label={displaySpellName(detail)}
          onClose={() => setDetail(undefined)}
        >
          <section className="modal v2-spell-dialog">
            <header className="modal-head">
              <div>
                <span className="character-eyebrow">Spell reference</span>
                <h2>{detail}</h2>
              </div>
              <button className="ghost" onClick={() => setDetail(undefined)}>
                Close
              </button>
            </header>
            {detailSpell && (
              <dl className="v2-spell-facts">
                {[
                  ["Casting time", detailSpell.castingTime],
                  ["Components", detailSpell.components],
                  ["Range", detailSpell.range],
                  ["Target / area", detailSpell.targetEffectArea],
                  ["Duration", detailSpell.duration],
                  ["Saving throw", detailSpell.savingThrow],
                  ["Spell resistance", detailSpell.spellResistance],
                  ["Source", detailSpell.source],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            )}
            <div className="v2-spell-full">{spellTitle(detail)}</div>
            {detailSpell && !detailSpell.components && (
              <p className="hint">
                Components are not supplied by this content pack. Check the
                source entry before casting.
              </p>
            )}
            {detailSpell?.sourceUrl &&
              /^https?:\/\//i.test(detailSpell.sourceUrl) && (
                <a
                  href={detailSpell.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the original spell source ↗
                </a>
              )}
          </section>
        </CharacterDialog>
      )}
      {preparation && caster && (
        <CharacterDialog
          label={
            preparation.index === undefined
              ? "Prepare spell"
              : "Reprepare spell"
          }
          onClose={() => setPreparation(undefined)}
        >
          <section className="modal v2-prepare-dialog">
            <header className="modal-head">
              <div>
                <span className="character-eyebrow">
                  {caster.className} · level {preparation.level}
                </span>
                <h2>
                  {preparation.index === undefined
                    ? "Prepare spell"
                    : "Reprepare spell"}
                </h2>
              </div>
            </header>
            <p>
              {preparation.index === undefined
                ? preparation.name
                : `Replace one unspent preparation of ${preparation.name}. Your current spell stays prepared until you confirm.`}
            </p>
            {preparation.index === undefined ? (
              <>
                <p>
                  {availableCopies} eligible spaces available ·{" "}
                  {room.restricted} domain / restricted spaces remain.
                </p>
                <label>
                  Copies
                  <input
                    type="number"
                    min={1}
                    max={availableCopies}
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(
                        Math.max(
                          1,
                          Math.floor(Number(event.target.value) || 1),
                        ),
                      )
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <input
                  type="search"
                  aria-label="Search replacement spells"
                  placeholder="Search your known spells…"
                  value={replaceSearch}
                  onChange={(event) => setReplaceSearch(event.target.value)}
                />
                <div className="v2-replacement-list">
                  {replacementNames.map((name) => (
                    <label key={name}>
                      <input
                        type="radio"
                        name="replacement"
                        checked={replacement === name}
                        onChange={() => setReplacement(name)}
                      />
                      <span>{displaySpellName(name)}</span>
                    </label>
                  ))}
                  {!replacementNames.length && (
                    <p>No eligible replacements in this source’s library.</p>
                  )}
                </div>
              </>
            )}
            <footer className="modal-actions">
              <button
                className="ghost"
                onClick={() => setPreparation(undefined)}
              >
                Cancel
              </button>
              <button
                disabled={
                  preparation.index === undefined
                    ? quantity > availableCopies
                    : !replacement
                }
                onClick={() => {
                  if (preparation.index === undefined) {
                    props.onAppendSelection(
                      key,
                      "prepared",
                      preparation.level,
                      preparation.name,
                      Math.min(quantity, availableCopies),
                    );
                  } else if (
                    canReplacePreparation(
                      caster,
                      preparation.level,
                      preparation.index,
                      replacement,
                    )
                  ) {
                    props.onUpdateSelectionName(
                      key,
                      "prepared",
                      preparation.level,
                      preparation.index,
                      replacement,
                    );
                  }
                  setPreparation(undefined);
                }}
              >
                Confirm{" "}
                {preparation.index === undefined
                  ? "preparation"
                  : "replacement"}
              </button>
            </footer>
          </section>
        </CharacterDialog>
      )}
    </div>
  );
}
