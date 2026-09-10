import { useState } from "react";
import "../character-references.css";
import {
  deriveLanguages,
  uniqueLanguages,
  type CharacterBuild,
} from "@mathfinder/rules-engine";
import { CharacterDialog } from "./CharacterDialog";

type Choices = NonNullable<CharacterBuild["languages"]>;
const parse = (value: string) => uniqueLanguages(value.split(/[,;\n]/));
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
  const [text, setText] = useState({
    starting: value.starting?.join(", ") ?? "",
    learned: value.learned?.join(", ") ?? "",
    additional: value.additional?.join(", ") ?? "",
  });
  return (
    <div className="language-fields">
      <p className="language-automatic">
        {rules.automatic.join(" · ") || "No ancestry languages recorded"}
      </p>
      {(["starting", "learned", "additional"] as const).map((key) => {
        const capacity =
          key === "starting"
            ? rules.startingCapacity
            : key === "learned"
              ? rules.learnedCapacity
              : undefined;
        const count = parse(text[key]).length;
        return (
          <label className="field" key={key}>
            <span>
              {key === "starting"
                ? "Starting languages"
                : key === "learned"
                  ? "Learned languages"
                  : "Additional / GM-granted languages"}
              {capacity !== undefined ? (
                <small className={count > capacity ? "form-error" : "hint"}>
                  {" "}
                  {count}/{capacity}
                </small>
              ) : null}
            </span>
            <textarea
              rows={2}
              placeholder="Language names, separated by commas"
              value={text[key]}
              onChange={(event) => {
                const next = { ...text, [key]: event.target.value };
                setText(next);
                onChange({
                  starting: parse(next.starting),
                  learned: parse(next.learned),
                  additional: parse(next.additional),
                });
              }}
            />
          </label>
        );
      })}
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
