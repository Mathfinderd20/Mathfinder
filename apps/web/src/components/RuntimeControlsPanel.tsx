import { useMemo, useState } from "react";
import {
  analyzeRuntimeBuff,
  tacticalCategoryLabel,
  type RuntimeBuffView,
  type RuntimeProfile,
  type RuntimeTacticalCategory,
} from "../runtimeInsights";

interface ActivatableView {
  id: string;
  name: string;
  description: string;
}

interface RuntimeControlsPanelProps {
  activatableGroups: {
    ungrouped: ActivatableView[];
    grouped: Record<string, ActivatableView[]>;
  };
  activatableConflicts: Array<{ group: string; ids: string[] }>;
  activeBuffs: Record<string, boolean>;
  resourcesUsed: Record<string, number>;
  resourceMaxes: Record<string, number>;
  resourceLabels: Record<string, string>;
  fatigued: boolean;
  buffs: RuntimeBuffView[];
  ownedSpellNames: string[];
  profile: RuntimeProfile;
  onSetToggle: (id: string, value: boolean) => void;
  onSetExclusiveToggleGroup: (ids: string[], activeId?: string) => void;
  onSetFlag: (key: string, value: boolean) => void;
  onAdjustResource: (id: string, delta: number, max?: number) => void;
  onResetResource: (id: string) => void;
}

function ResourceControls({
  featureId,
  resourceMaxes,
  resourceLabels,
  resourcesUsed,
  onAdjustResource,
  onResetResource,
}: {
  featureId: string;
  resourceMaxes: Record<string, number>;
  resourceLabels: Record<string, string>;
  resourcesUsed: Record<string, number>;
  onAdjustResource: (id: string, delta: number, max?: number) => void;
  onResetResource: (id: string) => void;
}) {
  const max = resourceMaxes[featureId];
  if (max === undefined) return null;
  const used = Math.min(resourcesUsed[featureId] ?? 0, max);
  const remaining = Math.max(0, max - used);
  const label = resourceLabels[featureId] ?? "left";
  return (
    <div className="resource-row">
      <span className="resource-label">
        {remaining}/{max} {label}
      </span>
      <div className="resource-buttons">
        <button
          className="ghost small"
          onClick={() => onAdjustResource(featureId, -1, max)}
        >
          -
        </button>
        <button
          className="ghost small"
          onClick={() => onAdjustResource(featureId, 1, max)}
        >
          +
        </button>
        <button
          className="ghost small"
          onClick={() => onResetResource(featureId)}
        >
          Rest
        </button>
      </div>
    </div>
  );
}

const TACTICAL_CATEGORIES: RuntimeTacticalCategory[] = [
  "offense",
  "defense",
  "mobility",
  "casting",
  "utility",
];
export function RuntimeControlsPanel({
  activatableGroups,
  activatableConflicts,
  activeBuffs,
  resourcesUsed,
  resourceMaxes,
  resourceLabels,
  fatigued,
  buffs,
  ownedSpellNames,
  profile,
  onSetToggle,
  onSetExclusiveToggleGroup,
  onSetFlag,
  onAdjustResource,
  onResetResource,
}: RuntimeControlsPanelProps) {
  const [showAllBuffs, setShowAllBuffs] = useState(false);
  const [effectSearch, setEffectSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    RuntimeTacticalCategory | "all"
  >("all");
  const activeEffectIds = useMemo(
    () =>
      new Set(
        Object.entries(activeBuffs)
          .filter(([, value]) => value)
          .map(([id]) => id),
      ),
    [activeBuffs],
  );
  const normalizedSearch = effectSearch.trim().toLowerCase();
  const ownedSpellNameSet = useMemo(
    () => new Set(ownedSpellNames.map((name) => name.trim().toLowerCase())),
    [ownedSpellNames],
  );
  const searchTerms = useMemo(
    () => normalizedSearch.split(/\s+/).filter(Boolean),
    [normalizedSearch],
  );
  const buffCards = useMemo(
    () =>
      buffs.map((buff) => ({
        buff,
        insight: analyzeRuntimeBuff(buff, profile),
        ownedSpell: ownedSpellNameSet.has(buff.name.trim().toLowerCase()),
      })),
    [buffs, ownedSpellNameSet, profile],
  );
  const matchingBuffCards = useMemo(
    () =>
      buffCards.filter(({ insight }) => {
        const matchesSearch =
          searchTerms.length === 0 ||
          searchTerms.every((term) => insight.searchText.includes(term));
        const matchesCategory =
          categoryFilter === "all" ||
          insight.categories.includes(categoryFilter);
        return matchesSearch && matchesCategory;
      }),
    [buffCards, categoryFilter, searchTerms],
  );
  const featuredBuffCards = useMemo(() => {
    const activeCards = matchingBuffCards.filter(({ buff }) =>
      activeEffectIds.has(buff.id),
    );
    const ownedSpellCards = matchingBuffCards.filter(
      ({ buff, ownedSpell }) => ownedSpell && !activeEffectIds.has(buff.id),
    );
    const topSuggestedByCategory = TACTICAL_CATEGORIES.flatMap((category) =>
      matchingBuffCards
        .filter(
          ({ buff, insight }) =>
            !activeEffectIds.has(buff.id) &&
            insight.categories.includes(category) &&
            insight.score >= 3,
        )
        .sort(
          (a, b) =>
            b.insight.score - a.insight.score ||
            a.buff.name.localeCompare(b.buff.name),
        )
        .slice(0, searchTerms.length > 0 || categoryFilter !== "all" ? 4 : 2),
    );
    const seen = new Set<string>();
    return [
      ...activeCards,
      ...ownedSpellCards,
      ...topSuggestedByCategory,
    ].filter(({ buff }) => {
      if (seen.has(buff.id)) return false;
      seen.add(buff.id);
      return true;
    });
  }, [activeEffectIds, categoryFilter, matchingBuffCards, searchTerms.length]);
  const otherBuffCards = useMemo(
    () =>
      matchingBuffCards.filter(
        ({ buff }) =>
          !featuredBuffCards.some((entry) => entry.buff.id === buff.id),
      ),
    [featuredBuffCards, matchingBuffCards],
  );
  const activeNamedBuffs = useMemo(
    () =>
      buffCards
        .filter(({ buff }) => activeEffectIds.has(buff.id))
        .map(({ buff }) => buff),
    [activeEffectIds, buffCards],
  );
  const activatableById = useMemo(
    () =>
      new Map(
        [
          ...activatableGroups.ungrouped,
          ...Object.values(activatableGroups.grouped).flat(),
        ].map((feature) => [feature.id, feature]),
      ),
    [activatableGroups],
  );
  const availableActivatableIds = useMemo(
    () =>
      new Set([
        ...activatableGroups.ungrouped.map((feature) => feature.id),
        ...Object.values(activatableGroups.grouped)
          .flat()
          .map((feature) => feature.id),
      ]),
    [activatableGroups],
  );
  const activeAbilityNames = useMemo(
    () =>
      [...availableActivatableIds]
        .filter((id) => activeBuffs[id])
        .map((id) => activatableById.get(id)?.name ?? id),
    [activeBuffs, activatableById, availableActivatableIds],
  );
  const tacticalSections = useMemo(() => {
    const sections: Record<RuntimeTacticalCategory, typeof featuredBuffCards> =
      {
        offense: [],
        defense: [],
        mobility: [],
        casting: [],
        utility: [],
      };
    for (const card of featuredBuffCards)
      sections[card.insight.primaryCategory].push(card);
    return sections;
  }, [featuredBuffCards]);
  const resourceActivatables = activatableGroups.ungrouped.filter(
    (feature) => resourceMaxes[feature.id] !== undefined,
  );
  const passiveActivatables = activatableGroups.ungrouped.filter(
    (feature) => resourceMaxes[feature.id] === undefined,
  );
  const rageActive = !!activeBuffs.rage;

  function applyTogglePreset(
    effectIds: string[],
    activatableIds: string[] = [],
  ) {
    const controlledBuffIds = buffs.map((buff) => buff.id);
    for (const id of controlledBuffIds) onSetToggle(id, effectIds.includes(id));
    for (const id of availableActivatableIds)
      onSetToggle(id, activatableIds.includes(id));
  }

  function clearAllRuntimeEffects() {
    applyTogglePreset([]);
    if (fatigued) onSetFlag("fatigued", false);
  }

  return (
    <section className="panel">
      <h2>Abilities, Buffs &amp; Auras</h2>
      <p className="hint">
        Context-aware runtime controls. Defaults stay focused on relevant stuff,
        and the rest is still searchable/addable when you want to get weird.
      </p>
      <div className="runtime-smart-summary">
        <span className="chip">
          {profile.classNames
            .map((name) => name.replace(/\b\w/g, (c) => c.toUpperCase()))
            .join(" / ") || "No class"}
        </span>
        {profile.meleeFocus ? (
          <span className="chip">Melee leaning</span>
        ) : null}
        {profile.rangedFocus ? (
          <span className="chip">Ranged capable</span>
        ) : null}
        {profile.casterFocus ? <span className="chip">Caster</span> : null}
        {fatigued ? <span className="chip warn-pill">Fatigued</span> : null}
        {rageActive ? <span className="chip ok-pill">Raging</span> : null}
      </div>
      {rageActive ? (
        <p className="hint warn-text">
          Ending Rage automatically applies Fatigued. Because consequences are a
          thing now.
        </p>
      ) : null}
      {activeNamedBuffs.length > 0 ||
      activeAbilityNames.length > 0 ||
      fatigued ? (
        <div className="mode-group runtime-active-tray">
          <div className="runtime-active-tray-head">
            <div className="mode-title">active effects tray</div>
            <button
              type="button"
              className="ghost small"
              onClick={clearAllRuntimeEffects}
            >
              Clear All
            </button>
          </div>
          <div className="runtime-chip-cloud">
            {activeAbilityNames.map((name) => (
              <span key={`active-ability-${name}`} className="chip ok-pill">
                {name}
              </span>
            ))}
            {activeNamedBuffs.map((buff) => (
              <button
                key={`active-effect-${buff.id}`}
                type="button"
                className="chip runtime-active-chip"
                onClick={() => onSetToggle(buff.id, false)}
              >
                {buff.name} ×
              </button>
            ))}
            {fatigued ? (
              <button
                type="button"
                className="chip runtime-active-chip warn-pill"
                onClick={() => onSetFlag("fatigued", false)}
              >
                Fatigued ×
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {resourceActivatables.length > 0 ? (
        <div className="mode-group">
          <div className="mode-title">limited-use abilities</div>
          {resourceActivatables.map((feature) => {
            const max = resourceMaxes[feature.id];
            const used = resourcesUsed[feature.id] ?? 0;
            const activationBlocked =
              max !== undefined && used >= max && !activeBuffs[feature.id];
            return (
              <div className="buff-block" key={feature.id}>
                <label className="buff">
                  <input
                    type="checkbox"
                    disabled={
                      activationBlocked || (feature.id === "rage" && fatigued)
                    }
                    checked={!!activeBuffs[feature.id]}
                    onChange={(e) => onSetToggle(feature.id, e.target.checked)}
                  />
                  <span>
                    <strong>{feature.name} (ability)</strong>
                    <span className="buff-desc">
                      {feature.description}
                      {feature.id === "rage" && fatigued
                        ? " Currently blocked by fatigue."
                        : ""}
                    </span>
                  </span>
                </label>
                <ResourceControls
                  featureId={feature.id}
                  resourceMaxes={resourceMaxes}
                  resourceLabels={resourceLabels}
                  resourcesUsed={resourcesUsed}
                  onAdjustResource={onAdjustResource}
                  onResetResource={onResetResource}
                />
              </div>
            );
          })}
        </div>
      ) : null}
      {passiveActivatables.length > 0 ? (
        <div className="mode-group">
          <div className="mode-title">toggle abilities</div>
          {passiveActivatables.map((feature) => {
            return (
              <div className="buff-block" key={feature.id}>
                <label className="buff">
                  <input
                    type="checkbox"
                    checked={!!activeBuffs[feature.id]}
                    onChange={(e) => onSetToggle(feature.id, e.target.checked)}
                  />
                  <span>
                    <strong>{feature.name} (ability)</strong>
                    <span className="buff-desc">{feature.description}</span>
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      ) : null}
      {Object.entries(activatableGroups.grouped).map(([group, items]) => (
        <div className="mode-group" key={group}>
          <div className="mode-title">{group.replace(/-/g, " ")}</div>
          {items.map((feature) => (
            <div className="buff-block" key={feature.id}>
              <label className="buff">
                <input
                  type="radio"
                  name={`mode-${group}`}
                  checked={!!activeBuffs[feature.id]}
                  onChange={() =>
                    onSetExclusiveToggleGroup(
                      items.map((item) => item.id),
                      feature.id,
                    )
                  }
                />
                <span>
                  <strong>{feature.name} (ability)</strong>
                  <span className="buff-desc">{feature.description}</span>
                </span>
              </label>
              <ResourceControls
                featureId={feature.id}
                resourceMaxes={resourceMaxes}
                resourceLabels={resourceLabels}
                resourcesUsed={resourcesUsed}
                onAdjustResource={onAdjustResource}
                onResetResource={onResetResource}
              />
            </div>
          ))}
          <button
            className="ghost small"
            onClick={() =>
              onSetExclusiveToggleGroup(items.map((item) => item.id))
            }
          >
            Clear mode
          </button>
        </div>
      ))}
      {activatableConflicts.length > 0 ? (
        <p className="hint warn-text">
          Conflicting modes were selected; only one per group applies.
        </p>
      ) : null}
      <div className="mode-group">
        <div className="mode-title">conditions</div>
        <label className="buff">
          <input
            type="checkbox"
            checked={fatigued}
            onChange={(e) => onSetFlag("fatigued", e.target.checked)}
          />
          <span>
            <strong>Fatigued</strong>
            <span className="buff-desc">
              Blocks Rage and can suppress other abilities later.
            </span>
          </span>
        </label>
      </div>
      <div className="mode-group">
        <div className="mode-title">effect finder</div>
        <label className="field compact runtime-effect-search">
          <span>Search effects</span>
          <input
            type="text"
            value={effectSearch}
            onChange={(e) => setEffectSearch(e.target.value)}
            placeholder="attack ac haste heroism mobility morale..."
          />
        </label>
        <div className="runtime-smart-summary">
          <button
            type="button"
            className={
              categoryFilter === "all"
                ? "ghost small runtime-filter-chip active"
                : "ghost small runtime-filter-chip"
            }
            onClick={() => setCategoryFilter("all")}
          >
            All
          </button>
          {TACTICAL_CATEGORIES.map((category) => (
            <button
              key={`filter-${category}`}
              type="button"
              className={
                categoryFilter === category
                  ? "ghost small runtime-filter-chip active"
                  : "ghost small runtime-filter-chip"
              }
              onClick={() => setCategoryFilter(category)}
            >
              {tacticalCategoryLabel(category)}
            </button>
          ))}
        </div>
        <p className="hint">
          Search matches names, descriptions, modifier targets, categories, and
          suggestion reasons.
        </p>
      </div>
      {TACTICAL_CATEGORIES.map((category) =>
        tacticalSections[category].length > 0 ? (
          <div className="mode-group" key={`tactical-${category}`}>
            <div className="mode-title">{tacticalCategoryLabel(category)}</div>
            {tacticalSections[category].map(({ buff, insight, ownedSpell }) => (
              <div className="buff-block" key={buff.id}>
                <label className="buff">
                  <input
                    type="checkbox"
                    checked={!!activeBuffs[buff.id]}
                    onChange={(e) => onSetToggle(buff.id, e.target.checked)}
                  />
                  <span>
                    <strong>{buff.name}</strong>
                    <span className="buff-desc">{buff.description}</span>
                    {buff.limitations?.length ? (
                      <span className="buff-desc">
                        Manual: {buff.limitations.join(" ")}
                      </span>
                    ) : null}
                    <span className="buff-desc">
                      {ownedSpell
                        ? "Available because your character knows this spell."
                        : `Why suggested: ${insight.reasons.join(", ")}`}
                    </span>
                  </span>
                </label>
                {buff.trackerMax !== undefined ? (
                  <ResourceControls
                    featureId={buff.id}
                    resourceMaxes={resourceMaxes}
                    resourceLabels={resourceLabels}
                    resourcesUsed={resourcesUsed}
                    onAdjustResource={onAdjustResource}
                    onResetResource={onResetResource}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null,
      )}
      {matchingBuffCards.length === 0 ? (
        <p className="hint warn-text">
          No effects matched that search/filter combo. Congratulations, you
          outsmarted the UI.
        </p>
      ) : null}
      {otherBuffCards.length > 0 ? (
        <div className="mode-group">
          <div className="mode-title">other effects</div>
          <button
            className="ghost small"
            type="button"
            onClick={() => setShowAllBuffs((value) => !value)}
          >
            {showAllBuffs
              ? "Hide Niche Effects"
              : `Show ${otherBuffCards.length} More Effects`}
          </button>
          {showAllBuffs
            ? otherBuffCards.map(({ buff }) => (
                <div className="buff-block" key={buff.id}>
                  <label className="buff">
                    <input
                      type="checkbox"
                      checked={!!activeBuffs[buff.id]}
                      onChange={(e) => onSetToggle(buff.id, e.target.checked)}
                    />
                    <span>
                      <strong>{buff.name}</strong>
                      <span className="buff-desc">{buff.description}</span>
                      {buff.limitations?.length ? (
                        <span className="buff-desc">
                          Manual: {buff.limitations.join(" ")}
                        </span>
                      ) : null}
                    </span>
                  </label>
                  {buff.trackerMax !== undefined ? (
                    <ResourceControls
                      featureId={buff.id}
                      resourceMaxes={resourceMaxes}
                      resourceLabels={resourceLabels}
                      resourcesUsed={resourcesUsed}
                      onAdjustResource={onAdjustResource}
                      onResetResource={onResetResource}
                    />
                  ) : null}
                </div>
              ))
            : null}
        </div>
      ) : null}
    </section>
  );
}
