import { useEffect, useMemo, useState } from "react";
import {
  featParameterOptions,
  featQualifiesForGrant,
  formatFeatSelection,
  getFeat,
  listFeats,
  parseFeatSelection,
  type FeatGrantKind,
  type FeatRegistry,
} from "@mathfinder/rules-engine";
import { featTitle } from "../rulesText";
import { CompendiumPicker, type CompendiumOption } from "./CompendiumPicker";

interface FeatSelectionPickerProps {
  value: string;
  onChange: (value: string) => void;
  featRegistry: FeatRegistry;
  grantKind: FeatGrantKind;
  availableWeaponNames?: string[];
  allowedOptions?: CompendiumOption[];
  placeholder?: string;
}

function selectionBaseName(selection: string) {
  return selection
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase();
}

export function buildBaseFeatOptions(
  featRegistry: FeatRegistry,
  grantKind: FeatGrantKind,
  allowedOptions?: CompendiumOption[],
): CompendiumOption[] {
  const allowedNames = allowedOptions?.length
    ? new Set(allowedOptions.map((option) => selectionBaseName(option.name)))
    : undefined;
  return listFeats(featRegistry)
    .filter((feat) => featQualifiesForGrant(feat, grantKind))
    .filter(
      (feat) => !allowedNames || allowedNames.has(feat.name.toLowerCase()),
    )
    .map((feat) => ({
      id: feat.id,
      name: feat.name,
      searchText: [
        feat.description,
        ...feat.prerequisites.map((prerequisite) => prerequisite.description),
        ...(feat.tags ?? []),
      ],
      tooltip: featTitle(feat.name),
      tags: [grantKind, ...(feat.tags ?? [])],
    }));
}

export function featSelectionIsComplete(
  featRegistry: FeatRegistry,
  value: string,
) {
  const parsed = parseFeatSelection(featRegistry, value);
  return !!parsed && (!parsed.feat.parameter || !!parsed.parameterValue);
}

export function beginFeatSelection(
  featRegistry: FeatRegistry,
  featName: string,
  currentValue: string,
): { committedValue: string; pendingFeatName?: string } | undefined {
  const feat = getFeat(featRegistry, featName);
  if (!feat) return undefined;
  if (!feat.parameter) return { committedValue: feat.name };
  const current = parseFeatSelection(featRegistry, currentValue);
  const keepsCommittedChoice =
    current?.feat.name.toLowerCase() === feat.name.toLowerCase() &&
    !!current.parameterValue;
  return {
    committedValue: keepsCommittedChoice ? currentValue : "",
    pendingFeatName: feat.name,
  };
}

export function FeatSelectionPicker({
  value,
  onChange,
  featRegistry,
  grantKind,
  availableWeaponNames,
  allowedOptions,
  placeholder = "Search feats",
}: FeatSelectionPickerProps) {
  const [pendingFeatName, setPendingFeatName] = useState<string>();
  const committed = parseFeatSelection(featRegistry, value);
  const pendingFeat = pendingFeatName
    ? getFeat(featRegistry, pendingFeatName)
    : undefined;
  const displayedFeat = pendingFeat ?? committed?.feat;
  const baseOptions = useMemo(
    () => buildBaseFeatOptions(featRegistry, grantKind, allowedOptions),
    [allowedOptions, featRegistry, grantKind],
  );
  const parameterOptions = pendingFeat?.parameter
    ? featParameterOptions(pendingFeat, availableWeaponNames)
    : [];
  const changingCommittedChoice =
    !!pendingFeat &&
    committed?.feat.name.toLowerCase() === pendingFeat.name.toLowerCase();

  useEffect(() => {
    if (
      committed?.feat.parameter &&
      !committed.parameterValue &&
      !pendingFeatName
    ) {
      onChange("");
    }
  }, [committed, onChange, pendingFeatName]);

  function selectBaseFeat(featName: string) {
    const next = beginFeatSelection(featRegistry, featName, value);
    if (!next) return;
    setPendingFeatName(next.pendingFeatName);
    onChange(next.committedValue);
  }

  function clearSelection() {
    setPendingFeatName(undefined);
    onChange("");
  }

  return (
    <div className="feat-selection-picker">
      <div className="feat-base-picker-row">
        <CompendiumPicker
          value={displayedFeat?.name ?? ""}
          onChange={selectBaseFeat}
          options={baseOptions}
          placeholder={placeholder}
          tooltip={displayedFeat ? featTitle(displayedFeat.name) : undefined}
          commitMode="select"
          maxResults={30}
        />
        {displayedFeat ? (
          <button
            type="button"
            className="ghost tiny feat-clear-button"
            onClick={clearSelection}
          >
            Clear
          </button>
        ) : null}
      </div>

      {pendingFeat?.parameter ? (
        <div className="feat-parameter-prompt">
          <label className="feat-parameter-field">
            <span>{pendingFeat.parameter.label}</span>
            <CompendiumPicker
              value={
                changingCommittedChoice ? (committed?.parameterValue ?? "") : ""
              }
              onChange={(parameterValue) => {
                onChange(formatFeatSelection(pendingFeat.name, parameterValue));
                setPendingFeatName(undefined);
              }}
              options={parameterOptions.map((parameterValue) => ({
                id: `${pendingFeat.id}:${parameterValue.toLowerCase()}`,
                name: parameterValue,
                tooltip: `${pendingFeat.name}: ${parameterValue}`,
              }))}
              placeholder={`Choose ${pendingFeat.parameter.label.toLowerCase()}`}
              commitMode="select"
              maxResults={40}
            />
            {parameterOptions.length === 0 ? (
              <span className="hint">
                No {pendingFeat.parameter.label.toLowerCase()} choices are
                loaded.
              </span>
            ) : null}
          </label>
          <button
            type="button"
            className="ghost tiny"
            onClick={() => setPendingFeatName(undefined)}
          >
            Cancel
          </button>
        </div>
      ) : committed?.feat.parameter && committed.parameterValue ? (
        <div className="feat-parameter-summary">
          <span>
            {committed.feat.parameter.label}:{" "}
            <strong>{committed.parameterValue}</strong>
          </span>
          <button
            type="button"
            className="ghost tiny"
            onClick={() => setPendingFeatName(committed.feat.name)}
          >
            Change
          </button>
        </div>
      ) : null}
    </div>
  );
}
