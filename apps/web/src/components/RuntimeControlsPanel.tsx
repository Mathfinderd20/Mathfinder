import { useMemo, useState } from "react";
import {
  effectDisposition,
  type RuntimeBuffView,
  type RuntimeProfile,
} from "../runtimeInsights";
import type {
  RuntimeAction,
  ActivatableResourceCost,
  DerivedResourcePool,
} from "@mathfinder/rules-engine";
import { EffectLibraryModal } from "./EffectLibraryModal";
import {
  FATIGUED_EFFECT_ID,
  retainedEffectKey,
  selectEffectActions,
} from "../effectSelection";
import { Tooltip, TooltipTriggerContext } from "./Tooltip";

interface ActivatableView {
  id: string;
  name: string;
  description: string;
  resourceCost?: ActivatableResourceCost;
  effects?: Array<{ value: number }>;
}

export interface RuntimeControlsPanelProps {
  showHeading?: boolean;
  runtimeFlags?: Record<string, boolean>;
  onApplyRuntimeActions?: (actions: RuntimeAction[]) => void;
  activatableGroups: {
    ungrouped: ActivatableView[];
    grouped: Record<string, ActivatableView[]>;
  };
  activatableConflicts: Array<{ group: string; ids: string[] }>;
  activatableBlockedReasons: Record<string, string>;
  activeBuffs: Record<string, boolean>;
  resourcesUsed: Record<string, number>;
  resourceMaxes: Record<string, number>;
  resourceLabels: Record<string, string>;
  resourcePools: DerivedResourcePool[];
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
  poolMode = false,
  mathTooltip,
}: {
  featureId: string;
  resourceMaxes: Record<string, number>;
  resourceLabels: Record<string, string>;
  resourcesUsed: Record<string, number>;
  onAdjustResource: (id: string, delta: number, max?: number) => void;
  onResetResource: (id: string) => void;
  poolMode?: boolean;
  mathTooltip?: string;
}) {
  const max = resourceMaxes[featureId];
  if (max === undefined) return null;
  const used = Math.min(resourcesUsed[featureId] ?? 0, max);
  const remaining = Math.max(0, max - used);
  const label = resourceLabels[featureId] ?? "left";
  return (
    <div className="resource-row">
      <Tooltip content={mathTooltip}>
        <span className="resource-label" tabIndex={mathTooltip ? 0 : undefined}>
          {remaining}/{max} {label}
        </span>
      </Tooltip>
      <div className="resource-buttons">
        <button
          className="ghost small"
          onClick={() => onAdjustResource(featureId, poolMode ? 1 : -1, max)}
        >
          {poolMode ? "Spend" : "-"}
        </button>
        <button
          className="ghost small"
          onClick={() => onAdjustResource(featureId, poolMode ? -1 : 1, max)}
        >
          {poolMode ? "Regain" : "+"}
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

export function resourcePoolMathTooltip(pool: DerivedResourcePool) {
  const terms = pool.calculation.contributions.map((contribution, index) => {
    const sign = contribution.value < 0 ? "− " : index > 0 ? "+ " : "";
    return `${sign}${contribution.label} ${Math.abs(contribution.value)}`;
  });
  const equation = `${terms.join(" ")} = ${pool.calculation.rawTotal}`;
  const minimumApplied = pool.calculation.rawTotal < pool.calculation.minimum;
  return `${pool.name} maximum: ${equation}.${
    minimumApplied
      ? ` Minimum ${pool.calculation.minimum} applies, for ${pool.max}.`
      : ` Total ${pool.max}.`
  }`;
}

export function activatableResourceFailure(
  feature: ActivatableView,
  resourceMaxes: Record<string, number>,
  resourcesUsed: Record<string, number>,
  resourceLabels: Record<string, string>,
) {
  const cost = feature.resourceCost;
  if (!cost) return undefined;
  const max = resourceMaxes[cost.poolId];
  const label = resourceLabels[cost.poolId] ?? "resource";
  if (max === undefined) return `${label} pool is unavailable`;
  const remaining = Math.max(0, max - (resourcesUsed[cost.poolId] ?? 0));
  return remaining < cost.amount
    ? `requires ${cost.amount} ${label} (${remaining} remaining)`
    : undefined;
}

export function RuntimeControlsPanel({
  showHeading = true,
  runtimeFlags = {},
  onApplyRuntimeActions,
  activatableGroups,
  activatableConflicts,
  activatableBlockedReasons,
  activeBuffs,
  resourcesUsed,
  resourceMaxes,
  resourceLabels,
  resourcePools,
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
  const [libraryOpen, setLibraryOpen] = useState(false);
  const buffCards = useMemo(
    () =>
      buffs.map((buff) => ({
        buff,
        ownedSpell: ownedSpellNames.some(
          (name) =>
            name.trim().toLowerCase() === buff.name.trim().toLowerCase(),
        ),
      })),
    [buffs, ownedSpellNames],
  );
  const ownedCards = buffCards.filter((card) => card.ownedSpell);
  const retainedBuffs = buffs.filter(
    (buff) => activeBuffs[buff.id] || runtimeFlags[retainedEffectKey(buff.id)],
  );
  const fatigueRetained =
    fatigued || !!runtimeFlags[retainedEffectKey(FATIGUED_EFFECT_ID)];
  const addedIds = [
    ...retainedBuffs.map((buff) => buff.id),
    ...(fatigueRetained ? [FATIGUED_EFFECT_ID] : []),
  ];
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
  const visibleUngrouped = activatableGroups.ungrouped;
  const visiblePools = resourcePools;
  const abilityCount =
    availableActivatableIds.size +
    resourcePools.length +
    buffCards.filter((card) => card.ownedSpell).length;
  const resourceActivatables = visibleUngrouped.filter(
    (feature) => resourceMaxes[feature.id] !== undefined,
  );
  const passiveActivatables = visibleUngrouped.filter(
    (feature) => resourceMaxes[feature.id] === undefined,
  );
  const rageActive = !!activeBuffs.rage;
  const [railSections, setRailSections] = useState(() => ({
    active:
      retainedBuffs.length > 0 ||
      activeAbilityNames.length > 0 ||
      fatigueRetained,
    abilities: abilityCount > 0,
    effects: true,
  }));

  function activationFailure(feature: ActivatableView) {
    return (
      activatableBlockedReasons[feature.id] ??
      activatableResourceFailure(
        feature,
        resourceMaxes,
        resourcesUsed,
        resourceLabels,
      )
    );
  }

  function spendActivationCost(feature: ActivatableView) {
    const cost = feature.resourceCost;
    if (!cost) return;
    onAdjustResource(cost.poolId, cost.amount, resourceMaxes[cost.poolId]);
  }

  function setActivatable(feature: ActivatableView, value: boolean) {
    if (value) {
      if (activationFailure(feature)) return;
      spendActivationCost(feature);
    }
    onSetToggle(feature.id, value);
    if (value) setRailSections((current) => ({ ...current, active: true }));
  }

  function selectActivatableGroup(
    items: ActivatableView[],
    feature: ActivatableView,
  ) {
    if (activationFailure(feature)) return;
    spendActivationCost(feature);
    setRailSections((current) => ({ ...current, active: true }));
    onSetExclusiveToggleGroup(
      items.map((item) => item.id),
      feature.id,
    );
  }

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
    applySelection(selectEffectActions(addedIds, false));
  }
  function applySelection(actions: RuntimeAction[]) {
    if (onApplyRuntimeActions) onApplyRuntimeActions(actions);
    else
      for (const action of actions) {
        if (action.type === "set-toggle") onSetToggle(action.id, action.value);
        if (action.type === "set-flag") onSetFlag(action.key, action.value);
      }
  }
  function removeEffect(id: string) {
    applySelection(selectEffectActions([id], false, false));
  }

  function setEffect(id: string, active: boolean) {
    applySelection(selectEffectActions([id], active));
    if (active) setRailSections((current) => ({ ...current, active: true }));
  }
  function renderEffectCard(buff: RuntimeBuffView, active: boolean) {
    return (
      <div
        className={`buff-block runtime-effect-card ${active ? "active" : ""} effect-${effectDisposition(buff)}`}
        key={buff.id}
      >
        <label className="buff">
          <input
            type="checkbox"
            role="switch"
            checked={active}
            onChange={(event) => setEffect(buff.id, event.target.checked)}
          />
          <span>
            <strong>{buff.name}</strong>
            <small className="runtime-card-source">Effect</small>
            <span className="buff-desc">{buff.description}</span>
            {buff.limitations?.length ? (
              <span className="buff-desc">
                Manual: {buff.limitations.join(" ")}
              </span>
            ) : null}
          </span>
        </label>
        <button
          type="button"
          className="ghost small effect-remove-button"
          aria-label={`Remove ${buff.name}`}
          onClick={() => removeEffect(buff.id)}
        >
          Remove
        </button>
        <ResourceControls
          featureId={buff.id}
          resourceMaxes={resourceMaxes}
          resourceLabels={resourceLabels}
          resourcesUsed={resourcesUsed}
          onAdjustResource={onAdjustResource}
          onResetResource={onResetResource}
        />
      </div>
    );
  }

  return (
    <TooltipTriggerContext.Provider value="click">
      <section className="panel runtime-controls-panel">
        {showHeading ? <h2>Abilities &amp; Effects</h2> : null}

        <details
          className="runtime-rail-section"
          open={railSections.effects}
          onToggle={(event) => {
            const open = event.currentTarget.open;
            setRailSections((current) =>
              current.effects === open
                ? current
                : { ...current, effects: open },
            );
          }}
        >
          <summary>Effects &amp; Conditions</summary>
          <div className="runtime-rail-section-body">
            <button
              type="button"
              className="ghost runtime-browse-button"
              onClick={() => setLibraryOpen(true)}
            >
              Browse effects &amp; conditions
            </button>
            <p className="hint">
              Search the library and apply several effects at once. Added cards
              stay in Active Now until removed.
            </p>
          </div>
        </details>
        <details
          className="runtime-rail-section"
          open={railSections.abilities}
          onToggle={(event) => {
            const open = event.currentTarget.open;
            setRailSections((current) =>
              current.abilities === open
                ? current
                : { ...current, abilities: open },
            );
          }}
        >
          <summary>
            My Abilities <span>{abilityCount}</span>
          </summary>
          <div className="runtime-rail-section-body">
            {visiblePools.length > 0 ? (
              <div className="mode-group">
                <div className="mode-title">resource pools</div>
                {visiblePools.map((pool) => (
                  <div className="buff-block" key={pool.id}>
                    <div className="buff">
                      <span>
                        <strong>{pool.name}</strong>
                        <span className="buff-desc">{pool.description}</span>
                      </span>
                    </div>
                    <ResourceControls
                      featureId={pool.id}
                      resourceMaxes={resourceMaxes}
                      resourceLabels={resourceLabels}
                      resourcesUsed={resourcesUsed}
                      onAdjustResource={onAdjustResource}
                      onResetResource={onResetResource}
                      poolMode
                      mathTooltip={resourcePoolMathTooltip(pool)}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {resourceActivatables.length > 0 ? (
              <div className="mode-group">
                <div className="mode-title">limited-use abilities</div>
                {resourceActivatables.map((feature) => {
                  const max = resourceMaxes[feature.id];
                  const used = resourcesUsed[feature.id] ?? 0;
                  const blockedReason =
                    activationFailure(feature) ??
                    (max !== undefined &&
                    used >= max &&
                    !activeBuffs[feature.id]
                      ? "resource exhausted"
                      : undefined);
                  return (
                    <div
                      className={`buff-block effect-${effectDisposition(feature)}`}
                      key={feature.id}
                    >
                      <label className="buff">
                        <input
                          type="checkbox"
                          disabled={
                            (!activeBuffs[feature.id] && !!blockedReason) ||
                            (feature.id === "rage" && fatigued)
                          }
                          checked={!!activeBuffs[feature.id]}
                          onChange={(e) =>
                            setActivatable(feature, e.target.checked)
                          }
                        />
                        <span>
                          <strong>{feature.name}</strong>
                          <span className="buff-desc">
                            {feature.description}
                            {feature.id === "rage" && fatigued
                              ? " Currently blocked by fatigue."
                              : blockedReason
                                ? ` Blocked: ${blockedReason}.`
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
                    <div
                      className={`buff-block effect-${effectDisposition(feature)}`}
                      key={feature.id}
                    >
                      <label className="buff">
                        <input
                          type="checkbox"
                          disabled={
                            !activeBuffs[feature.id] &&
                            !!activationFailure(feature)
                          }
                          checked={!!activeBuffs[feature.id]}
                          onChange={(e) =>
                            setActivatable(feature, e.target.checked)
                          }
                        />
                        <span>
                          <strong>{feature.name}</strong>
                          <span className="buff-desc">
                            {feature.description}
                            {activationFailure(feature)
                              ? ` Blocked: ${activationFailure(feature)}.`
                              : ""}
                          </span>
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
                {items.map((feature) => {
                  const blockedReason = activationFailure(feature);
                  return (
                    <div
                      className={`buff-block effect-${effectDisposition(feature)}`}
                      key={feature.id}
                    >
                      <label className="buff">
                        <input
                          type="radio"
                          name={`mode-${group}`}
                          disabled={!activeBuffs[feature.id] && !!blockedReason}
                          checked={!!activeBuffs[feature.id]}
                          onChange={() =>
                            selectActivatableGroup(items, feature)
                          }
                        />
                        <span>
                          <strong>{feature.name}</strong>
                          <span className="buff-desc">
                            {feature.description}
                            {blockedReason ? ` Blocked: ${blockedReason}.` : ""}
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
            {ownedCards.length ? (
              <div className="mode-group">
                <div className="mode-title">My spell effects</div>
                {ownedCards.map(({ buff }) => (
                  <div
                    className={`buff-block effect-${effectDisposition(buff)}`}
                    key={buff.id}
                  >
                    <label className="buff">
                      <input
                        type="checkbox"
                        checked={!!activeBuffs[buff.id]}
                        onChange={(event) =>
                          setEffect(buff.id, event.target.checked)
                        }
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
                    <ResourceControls
                      featureId={buff.id}
                      resourceMaxes={resourceMaxes}
                      resourceLabels={resourceLabels}
                      resourcesUsed={resourcesUsed}
                      onAdjustResource={onAdjustResource}
                      onResetResource={onResetResource}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {!visibleUngrouped.length &&
            !visiblePools.length &&
            !ownedCards.length &&
            !Object.values(activatableGroups.grouped).flat().length ? (
              <p className="hint">No abilities recorded.</p>
            ) : null}
            {activatableConflicts.length > 0 ? (
              <p className="hint warn-text">
                Conflicting modes were selected; only one per group applies.
              </p>
            ) : null}
          </div>
        </details>
        <details
          className="runtime-rail-section"
          open={railSections.active}
          onToggle={(event) => {
            const open = event.currentTarget.open;
            setRailSections((current) =>
              current.active === open ? current : { ...current, active: open },
            );
          }}
        >
          <summary>
            Active Now{" "}
            <span>
              {retainedBuffs.length +
                activeAbilityNames.length +
                Number(fatigueRetained)}
            </span>
          </summary>
          <div className="runtime-rail-section-body">
            {rageActive ? (
              <p className="hint warn-text">Ending Rage applies Fatigued.</p>
            ) : null}
            {[...availableActivatableIds]
              .filter((id) => activeBuffs[id])
              .map((id) => {
                const feature = activatableById.get(id)!;
                return (
                  <div
                    className={`buff-block runtime-effect-card active effect-${effectDisposition(feature)}`}
                    key={id}
                  >
                    <label className="buff">
                      <input
                        type="checkbox"
                        role="switch"
                        checked
                        onChange={() => onSetToggle(id, false)}
                      />
                      <span>
                        <strong>{feature.name}</strong>
                        <small className="runtime-card-source">
                          Character ability
                        </small>
                        <span className="buff-desc">{feature.description}</span>
                      </span>
                    </label>
                  </div>
                );
              })}
            {retainedBuffs
              .filter((buff) => !availableActivatableIds.has(buff.id))
              .map((buff) => renderEffectCard(buff, !!activeBuffs[buff.id]))}
            {fatigueRetained ? (
              <div className="buff-block runtime-effect-card effect-detrimental">
                <label className="buff">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={fatigued}
                    onChange={(event) =>
                      setEffect(FATIGUED_EFFECT_ID, event.target.checked)
                    }
                  />
                  <span>
                    <strong>Fatigued</strong>
                    <small className="runtime-card-source">Condition</small>
                    <span className="buff-desc">
                      −2 Strength and Dexterity; cannot run or charge. Blocks
                      Rage.
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  className="ghost small effect-remove-button"
                  onClick={() => removeEffect(FATIGUED_EFFECT_ID)}
                >
                  Remove Fatigued
                </button>
              </div>
            ) : null}
            {!retainedBuffs.length &&
            !activeAbilityNames.length &&
            !fatigued ? (
              <p className="hint">No active abilities or effects.</p>
            ) : (
              <button
                type="button"
                className="ghost small"
                onClick={clearAllRuntimeEffects}
              >
                Turn All Off
              </button>
            )}
          </div>
        </details>
        {libraryOpen ? (
          <EffectLibraryModal
            buffs={buffs}
            profile={profile}
            ownedSpellNames={ownedSpellNames}
            addedIds={addedIds}
            onClose={() => setLibraryOpen(false)}
            onApply={(ids) => {
              applySelection(selectEffectActions(ids, true));
              setRailSections((current) => ({ ...current, active: true }));
              setLibraryOpen(false);
            }}
          />
        ) : null}
      </section>
    </TooltipTriggerContext.Provider>
  );
}
