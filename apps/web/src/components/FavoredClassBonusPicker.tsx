import type { FavoredClassBonusOption } from "../favoredClassBonusData";

interface Props {
  options: FavoredClassBonusOption[];
  value: string | undefined;
  detailValue: string | undefined;
  radioName: string;
  onChange: (value: string | undefined) => void;
  onDetailChange: (value: string | undefined) => void;
}

export function FavoredClassBonusPicker({
  options,
  value,
  detailValue,
  radioName,
  onChange,
  onDetailChange,
}: Props) {
  const selected = options.find((option) => option.value === value);
  const detail = selected?.detail;
  return (
    <>
      <div className="ability-picker">
        {options.map((option) => {
          const optionValue = option.value || undefined;
          return (
            <label
              className={`pick ${value === optionValue ? "on" : ""}`}
              key={option.value || "none"}
              title={option.description}
            >
              <input
                type="radio"
                name={radioName}
                checked={value === optionValue}
                disabled={option.disabled}
                onChange={() => {
                  onChange(optionValue);
                  onDetailChange(undefined);
                }}
              />
              {option.label}
            </label>
          );
        })}
      </div>
      {detail ? (
        <label className="field compact">
          <span>{detail.label}</span>
          {detail.control === "select" ? (
            <select
              required
              value={detailValue ?? ""}
              onChange={(event) =>
                onDetailChange(event.target.value || undefined)
              }
            >
              <option value="">Choose an option</option>
              {detail.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              required
              value={detailValue ?? ""}
              placeholder="Enter the bloodline power"
              onChange={(event) =>
                onDetailChange(event.target.value || undefined)
              }
            />
          )}
          {!detailValue?.trim() ? (
            <span className="form-error">This bonus requires a choice.</span>
          ) : null}
        </label>
      ) : null}
    </>
  );
}
