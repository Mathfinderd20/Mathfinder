import type { DerivedSheet } from "@mathfinder/rules-engine";
import "../character-references.css";
import {
  RUNTIME_ARCHETYPES,
  RUNTIME_CLASS_FEATURES,
  RUNTIME_FEATS,
} from "../content";
import {
  characterReferences,
  type CharacterReference,
} from "../characterReferences";
import { useCharacterUiState } from "../features/characters/CharacterUiSession";
import { CharacterDialog } from "./CharacterDialog";
import {
  activatableResourceFailure,
  type RuntimeControlsPanelProps,
} from "./RuntimeControlsPanel";

export type ReferenceRuntime = Pick<
  RuntimeControlsPanelProps,
  | "activatableGroups"
  | "activatableBlockedReasons"
  | "activeBuffs"
  | "resourcesUsed"
  | "resourceMaxes"
  | "resourceLabels"
  | "onSetToggle"
  | "onSetExclusiveToggleGroup"
  | "onAdjustResource"
>;

export function CharacterReferenceRows({
  characterId,
  sheet,
  campaignTraits,
  runtime,
}: {
  characterId: string;
  sheet: DerivedSheet;
  campaignTraits: string[];
  runtime?: ReferenceRuntime;
}) {
  const [selectedId, setSelectedId] = useCharacterUiState<string | null>(
    characterId,
    "reference-dialog",
    null,
  );
  const [collapsed, setCollapsed] = useCharacterUiState<
    Record<string, boolean>
  >(characterId, "reference-groups", {});
  const groups = characterReferences(
    sheet,
    campaignTraits,
    RUNTIME_CLASS_FEATURES,
    RUNTIME_FEATS,
    RUNTIME_ARCHETYPES,
  );
  const selected = groups
    .flatMap((group) => group.rows)
    .find((row) => row.id === selectedId);

  function controls(row: CharacterReference) {
    if (!runtime || row.suppressed) return null;
    const activation = row.activation;
    const resourceId = row.resourceId;
    const max = resourceId ? runtime.resourceMaxes[resourceId] : undefined;
    const used = resourceId ? (runtime.resourcesUsed[resourceId] ?? 0) : 0;
    const active = activation ? !!runtime.activeBuffs[activation.id] : false;
    const blocked = activation
      ? (runtime.activatableBlockedReasons[activation.id] ??
        activatableResourceFailure(
          activation,
          runtime.resourceMaxes,
          runtime.resourcesUsed,
          runtime.resourceLabels,
        ) ??
        (activation.resource && max !== undefined && used >= max
          ? "Resource exhausted"
          : undefined))
      : undefined;
    function toggle(value: boolean) {
      if (!activation || !runtime || (value && blocked)) return;
      if (value && activation.resourceCost)
        runtime.onAdjustResource(
          activation.resourceCost.poolId,
          activation.resourceCost.amount,
          runtime.resourceMaxes[activation.resourceCost.poolId],
        );
      if (activation.group) {
        runtime.onSetExclusiveToggleGroup(
          (runtime.activatableGroups.grouped[activation.group] ?? []).map(
            (entry) => entry.id,
          ),
          value ? activation.id : undefined,
        );
      } else runtime.onSetToggle(activation.id, value);
    }
    return (
      <div className="reference-controls">
        {resourceId && max !== undefined ? (
          <div className="reference-usage">
            <span>
              <strong>
                {Math.max(0, max - used)}/{max}
              </strong>{" "}
              {runtime.resourceLabels[resourceId] ?? "uses"} remaining
            </span>
            <div>
              <button
                type="button"
                className="ghost small"
                disabled={used >= max}
                aria-label={`Use ${row.name}`}
                onClick={() => runtime.onAdjustResource(resourceId, 1, max)}
              >
                Use
              </button>
              <button
                type="button"
                className="ghost small"
                disabled={used <= 0}
                aria-label={`Restore one use of ${row.name}`}
                onClick={() => runtime.onAdjustResource(resourceId, -1, max)}
              >
                Regain
              </button>
            </div>
          </div>
        ) : null}
        {activation ? (
          <label className="reference-toggle" title={blocked}>
            <input
              type="checkbox"
              role="switch"
              aria-label={`Activate ${row.name}`}
              checked={active}
              disabled={!active && !!blocked}
              onChange={(event) => toggle(event.target.checked)}
            />
            <span>{active ? "On" : "Off"}</span>
          </label>
        ) : null}
        {blocked && !active ? <small className="hint">{blocked}</small> : null}
      </div>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <details
          className="sheet-reference-group"
          key={group.name}
          open={!collapsed[group.name]}
          onToggle={(event) => {
            const closed = !event.currentTarget.open;
            if (!!collapsed[group.name] !== closed)
              setCollapsed((current) => ({ ...current, [group.name]: closed }));
          }}
        >
          <summary>
            {group.name}
            <span>{group.rows.length}</span>
          </summary>
          <div className="reference-rows">
            {group.rows.map((row, index) => (
              <div className="reference-row" key={`${row.id}:${index}`}>
                <button
                  type="button"
                  className="reference-description"
                  onClick={() => setSelectedId(row.id)}
                  aria-label={`Details for ${row.name}`}
                >
                  <span className="reference-name">
                    <strong>{row.name}</strong>
                    <small>
                      {row.level ? `L${row.level} · ` : ""}
                      {row.source}
                    </small>
                  </span>
                  <span className="reference-summary">{row.description}</span>
                  {row.details.length ? (
                    <span className="reference-metrics">
                      {row.details.map((detail) => (
                        <span key={detail}>{detail}</span>
                      ))}
                    </span>
                  ) : null}
                  {row.suppressed ? (
                    <small>Suppressed: {row.suppressed}</small>
                  ) : null}
                </button>
                {controls(row)}
              </div>
            ))}
            {!group.rows.length ? (
              <p className="hint">No {group.name.toLowerCase()} recorded.</p>
            ) : null}
          </div>
        </details>
      ))}
      {selected ? (
        <CharacterDialog
          label={selected.name}
          onClose={() => setSelectedId(null)}
        >
          <div className="modal reference-detail-dialog">
            <div className="modal-head">
              <div>
                <small>{selected.source}</small>
                <h2>{selected.name}</h2>
              </div>
              <button
                type="button"
                className="ghost small"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>
            <p className="reference-full-description">{selected.description}</p>
            {selected.details.length ? (
              <div className="reference-metrics">
                {selected.details.map((detail) => (
                  <span key={detail}>{detail}</span>
                ))}
              </div>
            ) : null}
            {selected.activation ? (
              <p className="hint">{selected.activation.description}</p>
            ) : null}
            {selected.suppressed ? (
              <p className="hint">Suppressed: {selected.suppressed}</p>
            ) : null}
            {controls(selected)}
            {selected.resourceId ? (
              <p className="hint">
                Uses are shared with Abilities &amp; Effects and reset when you
                Rest.
              </p>
            ) : null}
          </div>
        </CharacterDialog>
      ) : null}
    </>
  );
}
