import {
  searchCompendiumEntries,
  type CompendiumEntry,
} from "@mathfinder/rules-engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "./Tooltip";

export interface CompendiumOption {
  id: string;
  name: string;
  searchText?: string | string[];
  tooltip?: string;
  tags?: string[];
}

interface CompendiumPickerProps {
  value: string;
  onChange: (value: string) => void;
  options: CompendiumOption[];
  placeholder?: string;
  tooltip?: string;
  maxResults?: number;
}

interface IndexedCompendiumOption extends CompendiumEntry {
  tooltip?: string;
  searchText?: string | string[];
}

const DEFAULT_MAX_RESULTS = 8;

export function CompendiumPicker({
  value,
  onChange,
  options,
  placeholder,
  tooltip,
  maxResults = DEFAULT_MAX_RESULTS,
}: CompendiumPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const indexedOptions = useMemo<IndexedCompendiumOption[]>(
    () =>
      options.map((option) => ({
        id: option.id,
        name: option.name,
        tooltip: option.tooltip,
        searchText: option.searchText,
        tags: option.tags,
      })),
    [options],
  );

  const selectedOption = useMemo(
    () =>
      indexedOptions.find(
        (option) => option.name.toLowerCase() === value.trim().toLowerCase(),
      ),
    [indexedOptions, value],
  );

  const results = useMemo(
    () =>
      searchCompendiumEntries(indexedOptions, value, [
        (option) => option.searchText,
      ]).slice(0, maxResults),
    [indexedOptions, maxResults, value],
  );

  const showResults = open && results.length > 0;
  const activeTooltip = selectedOption?.tooltip ?? tooltip;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="searchable-picker">
      <Tooltip content={activeTooltip} className="mf-tooltip-anchor-block">
        <input
          className="searchable-name-input"
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
        />
      </Tooltip>
      {showResults ? (
        <div className="searchable-picker-results">
          {results.map((option) => {
            const isSelected =
              option.name.toLowerCase() === value.trim().toLowerCase();
            return (
              <button
                key={option.id}
                type="button"
                className={`searchable-picker-option${isSelected ? " selected" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.name);
                  setOpen(false);
                }}
                title={option.tooltip}
              >
                <span className="searchable-picker-option-name">
                  {option.name}
                </span>
                {option.tags?.length ? (
                  <span className="searchable-picker-option-meta">
                    {option.tags.join(" · ")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
