import { useMemo, useState } from "react";
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

export function FeatSelectionPicker({
  value,
  onChange,
  featRegistry,
  grantKind,
  availableWeaponNames,
  allowedOptions,
  placeholder = "Search feats",
}: FeatSelectionPickerProps) {
  const [editingParameter, setEditingParameter] = useState(false);
  const parsed = parseFeatSelection(featRegistry, value);
  const selectedFeat = parsed?.feat;
  const baseOptions = useMemo(
    () => buildBaseFeatOptions(featRegistry, grantKind, allowedOptions),
    [allowedOptions, featRegistry, grantKind],
  );
  const parameterOptions = selectedFeat?.parameter
    ? featParameterOptions(selectedFeat, availableWeaponNames)
    : [];
  const showParameterPicker =
    !!selectedFeat?.parameter && (!parsed?.parameterValue || editingParameter);

  return (
    <div className="feat-selection-picker">
      <CompendiumPicker
        value={selectedFeat?.name ?? ""}
        onChange={(featName) => {
          const feat = getFeat(featRegistry, featName);
          setEditingParameter(!!feat?.parameter);
          onChange(feat?.parameter ? feat.name : featName);
        }}
        options={baseOptions}
        placeholder={placeholder}
        tooltip={selectedFeat ? featTitle(selectedFeat.name) : undefined}
        commitMode="select"
        maxResults={30}
      />
      {showParameterPicker && selectedFeat?.parameter ? (
        <label className="feat-parameter-field">
          <span>{selectedFeat.parameter.label}</span>
          <CompendiumPicker
            value={parsed?.parameterValue ?? ""}
            onChange={(parameterValue) => {
              onChange(formatFeatSelection(selectedFeat.name, parameterValue));
              setEditingParameter(false);
            }}
            options={parameterOptions.map((parameterValue) => ({
              id: `${selectedFeat.id}:${parameterValue.toLowerCase()}`,
              name: parameterValue,
              tooltip: `${selectedFeat.name}: ${parameterValue}`,
            }))}
            placeholder={`Choose ${selectedFeat.parameter.label.toLowerCase()}`}
            commitMode="select"
            maxResults={40}
          />
          {parameterOptions.length === 0 ? (
            <span className="hint">
              No {selectedFeat.parameter.label.toLowerCase()} choices are
              loaded.
            </span>
          ) : null}
        </label>
      ) : selectedFeat?.parameter && parsed?.parameterValue ? (
        <div className="feat-parameter-summary">
          <span>
            {selectedFeat.parameter.label}:{" "}
            <strong>{parsed.parameterValue}</strong>
          </span>
          <button
            type="button"
            className="ghost tiny"
            onClick={() => setEditingParameter(true)}
          >
            Change
          </button>
        </div>
      ) : null}
    </div>
  );
}
