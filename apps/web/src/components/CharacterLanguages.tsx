import { useState } from "react";
import "../character-references.css";
import {
  CANONICAL_LANGUAGES,
  SELECTABLE_CANONICAL_LANGUAGES,
  deriveLanguages,
  uniqueLanguages,
  type CharacterBuild,
} from "@mathfinder/rules-engine";
import { CharacterDialog } from "./CharacterDialog";

type Choices = NonNullable<CharacterBuild["languages"]>;

function LanguageSlots({
  category,
  label,
  values,
  capacity,
  blocked,
  allowRestricted = false,
  onChange,
}: {
  category: "starting" | "learned" | "additional";
  label: string;
  values: string[];
  capacity?: number;
  blocked: Set<string>;
  allowRestricted?: boolean;
  onChange: (values: string[]) => void;
}) {
  const options = allowRestricted
    ? CANONICAL_LANGUAGES
    : SELECTABLE_CANONICAL_LANGUAGES;
  const slotCount =
    capacity === undefined
      ? Math.max(1, values.length + 1)
      : Math.max(capacity, values.length);
  return (
    <fieldset className="field language-choice-group">
      <legend>
        {label}
        {capacity !== undefined ? (
          <small className={values.length > capacity ? "form-error" : "hint"}>
            {" "}
            {values.length}/{capacity}
          </small>
        ) : null}
      </legend>
      {slotCount === 0 ? (
        <span className="hint">No choices available.</span>
      ) : (
        Array.from({ length: slotCount }, (_, index) => {
          const current = values[index] ?? "";
          const canonicalCurrent = CANONICAL_LANGUAGES.find(
            (language) => language.toLowerCase() === current.toLowerCase(),
          );
          const availableCurrent = options.find(
            (language) => language.toLowerCase() === current.toLowerCase(),
          );
          return (
            <select
              key={`${category}-${index}`}
              aria-label={`${label} choice ${index + 1}`}
              value={availableCurrent ?? current}
              onChange={(event) => {
                const next = [...values];
                if (event.target.value) next[index] = event.target.value;
                else next.splice(index, 1);
                onChange(uniqueLanguages(next));
              }}
            >
              <option value="">Choose a language</option>
              {current && !availableCurrent ? (
                <option value={current}>
                  {current} ({canonicalCurrent ? "restricted" : "legacy"} value)
                </option>
              ) : null}
              {options.map((language) => (
                <option
                  key={language}
                  value={language}
                  disabled={
                    language.toLowerCase() !== current.toLowerCase() &&
                    (blocked.has(language.toLowerCase()) ||
                      values.some(
                        (value) =>
                          value.toLowerCase() === language.toLowerCase(),
                      ))
                  }
                >
                  {language}
                </option>
              ))}
            </select>
          );
        })
      )}
    </fieldset>
  );
}

export function LanguageFields({
  build,
  value,
  onChange,
}: {
  build: CharacterBuild;
  value: Choices;
  onChange: (value: Choices) => void;
}) {
  const rules = deriveLanguages(build);
  const starting = value.starting ?? [];
  const learned = value.learned ?? [];
  const additional = value.additional ?? [];
  const automatic = new Set(
    rules.automatic.map((language) => language.toLowerCase()),
  );

  function update(category: keyof Choices, languages: string[]) {
    onChange({ ...value, [category]: languages });
  }

  function blocked(except: keyof Choices) {
    const selected = [
      ...(except === "starting" ? [] : starting),
      ...(except === "learned" ? [] : learned),
      ...(except === "additional" ? [] : additional),
    ];
    return new Set([
      ...automatic,
      ...selected.map((language) => language.toLowerCase()),
    ]);
  }

  return (
    <div className="language-fields">
      <p className="language-automatic">
        {rules.automatic.join(" · ") || "No ancestry languages recorded"}
      </p>
      <LanguageSlots
        category="starting"
        label="Starting languages"
        values={starting}
        capacity={rules.startingCapacity}
        blocked={blocked("starting")}
        onChange={(languages) => update("starting", languages)}
      />
      <LanguageSlots
        category="learned"
        label="Learned languages"
        values={learned}
        capacity={rules.learnedCapacity}
        blocked={blocked("learned")}
        onChange={(languages) => update("learned", languages)}
      />
      <LanguageSlots
        category="additional"
        label="Additional / GM-granted languages"
        values={additional}
        blocked={blocked("additional")}
        allowRestricted
        onChange={(languages) => update("additional", languages)}
      />
    </div>
  );
}
export function CharacterLanguages({
  build,
  onChange,
  hideHeading = false,
}: {
  build: CharacterBuild;
  onChange?: (languages: Choices) => void;
  hideHeading?: boolean;
}) {
  const [draft, setDraft] = useState<Choices | null>(null);
  const rules = deriveLanguages(build);
  const overBudget =
    draft &&
    ((draft.starting?.length ?? 0) > rules.startingCapacity ||
      (draft.learned?.length ?? 0) > rules.learnedCapacity);
  return (
    <div className="character-languages">
      {(!hideHeading || onChange) && (
        <div className="sheet-panel-heading">
          {!hideHeading && <h4>Languages</h4>}
          {onChange && (
            <button
              type="button"
              className="ghost small"
              onClick={() => setDraft(build.languages ?? {})}
            >
              Edit languages
            </button>
          )}
        </div>
      )}
      <div className="sheet-reference-notes">
        {rules.all.map((name) => (
          <span key={name}>{name}</span>
        ))}
        {!rules.all.length && (
          <span className="hint">Languages not recorded</span>
        )}
      </div>
      {draft && (
        <CharacterDialog label="Edit languages" onClose={() => setDraft(null)}>
          <section className="modal language-dialog">
            <header className="modal-head">
              <h2>Edit languages</h2>
            </header>
            <LanguageFields build={build} value={draft} onChange={setDraft} />
            {overBudget && (
              <p className="form-error">
                Language choices exceed the available allowance. Move approved
                extras to Additional / GM-granted languages.
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setDraft(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!overBudget}
                onClick={() => {
                  onChange?.(draft);
                  setDraft(null);
                }}
              >
                Save languages
              </button>
            </div>
          </section>
        </CharacterDialog>
      )}
    </div>
  );
}
