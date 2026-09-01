import {
  searchCompendiumEntries,
  type CompendiumEntry,
} from "@mathfinder/rules-engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "./Tooltip";

export interface CompendiumOption extends CompendiumEntry {
  searchText?: string | string[];
  tooltip?: string;
}

interface CompendiumPickerProps {
  value: string;
  onChange: (value: string) => void;
  options: CompendiumOption[];
  placeholder?: string;
  tooltip?: string;
  maxResults?: number;
  commitMode?: "immediate" | "select";
  resolveOptions?: (query: string) => CompendiumOption[];
  inlineResults?: boolean;
}

const DEFAULT_MAX_RESULTS = 8;

export function searchCompendiumOptions(
  options: readonly CompendiumOption[],
  query: string,
): CompendiumOption[] {
  return searchCompendiumEntries(options, query, [
    (option) => option.searchText,
  ]);
}

export function CompendiumPicker({
  value,
  onChange,
  options,
  placeholder,
  tooltip,
  maxResults = DEFAULT_MAX_RESULTS,
  commitMode = "immediate",
  resolveOptions,
  inlineResults = false,
}: CompendiumPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [debouncedQuery, setDebouncedQuery] = useState(value);

  const selectedOptionPool = useMemo(() => {
    if (!value.trim()) return [] as CompendiumOption[];
    return resolveOptions ? resolveOptions(value) : options;
  }, [options, resolveOptions, value]);

  const selectedOption = useMemo(
    () =>
      selectedOptionPool.find(
        (option) => option.name.toLowerCase() === value.trim().toLowerCase(),
      ),
    [selectedOptionPool, value],
  );

  const results = useMemo(() => {
    if (!open && !debouncedQuery.trim()) return [] as CompendiumOption[];
    if (resolveOptions)
      return resolveOptions(debouncedQuery).slice(0, maxResults);
    return searchCompendiumOptions(options, debouncedQuery).slice(
      0,
      maxResults,
    );
  }, [debouncedQuery, maxResults, open, options, resolveOptions]);

  const showResults = open;
  const activeTooltip = selectedOption?.tooltip ?? tooltip;

  useEffect(() => {
    if (!open) {
      setQuery(value);
      setDebouncedQuery(value);
    }
  }, [open, value]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 100);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (commitMode !== "immediate" || query === value) return;
    const timeout = window.setTimeout(() => onChange(query), 250);
    return () => window.clearTimeout(timeout);
  }, [commitMode, onChange, query, value]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        if (commitMode === "select") setQuery(value);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [commitMode, value]);

  return (
    <div ref={rootRef} className="searchable-picker">
      <Tooltip content={activeTooltip} className="mf-tooltip-anchor-block">
        <input
          className="searchable-name-input"
          type="text"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const exact = results.find(
                (option) =>
                  option.name.toLowerCase() === query.trim().toLowerCase(),
              );
              const chosen = exact ?? results[0];
              if (chosen) {
                onChange(chosen.name);
                setQuery(chosen.name);
                setOpen(false);
                event.preventDefault();
              }
            }
            if (event.key === "Escape") {
              setQuery(value);
              setOpen(false);
            }
          }}
          onBlur={() => {
            if (commitMode === "select") setQuery(value);
            else if (query !== value) onChange(query);
          }}
        />
      </Tooltip>
      {showResults ? (
        <div
          className={`searchable-picker-results${inlineResults ? " inline-results" : ""}`}
        >
          {results.length > 0 ? (
            results.map((option) => {
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
                    setQuery(option.name);
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
            })
          ) : (
            <div className="searchable-picker-empty">No matches.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
