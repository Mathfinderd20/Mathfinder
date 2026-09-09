import { healthPresentation } from "../../characterPresentation";
import { useRef, useState } from "react";
import {
  ALIGNMENT_LABELS,
  type CharacterBuild,
  type HealthCondition,
  type DerivedSheet,
} from "@mathfinder/rules-engine";
import type { CharacterDetails, CharacterProfile } from "./characterRepository";

interface Props {
  build: CharacterBuild;
  currentHp: number;
  details: CharacterDetails;
  onChange: (details: CharacterDetails) => void;
  tempHp: number;
  healthCondition: HealthCondition;
  sheet: DerivedSheet;
}

const PROFILE_FIELDS: Array<{
  key: keyof CharacterProfile;
  label: string;
  placeholder: string;
}> = [
  { key: "deity", label: "Deity", placeholder: "Deity or faith" },
  { key: "gender", label: "Gender", placeholder: "Gender" },
  { key: "age", label: "Age", placeholder: "Age" },
  { key: "height", label: "Height", placeholder: "Height" },
  { key: "weight", label: "Weight", placeholder: "Weight" },
  { key: "homeland", label: "Homeland", placeholder: "Homeland" },
  {
    key: "associations",
    label: "Associations",
    placeholder: "Guilds, orders, factions",
  },
];

function classSummary(build: CharacterBuild) {
  const counts = new Map<string, number>();
  for (const level of build.levels) {
    counts.set(level.className, (counts.get(level.className) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => `${name} ${count}`)
    .join(" / ");
}

export function CharacterIdentityBar({
  build,
  currentHp,
  details,
  onChange,
  tempHp,
  healthCondition,
  sheet,
}: Props) {
  const health = healthPresentation(
    currentHp,
    sheet.hitPoints.total,
    healthCondition,
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CharacterProfile>(details.profile ?? {});
  const uploadRef = useRef<HTMLInputElement>(null);
  const alignment = sheet.descriptor.alignment
    ? ALIGNMENT_LABELS[sheet.descriptor.alignment]
    : "Unspecified";

  function openEditor() {
    setDraft(details.profile ?? {});
    setEditing(true);
  }

  function readPortrait(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 1_000_000) {
      window.alert("Portraits must be smaller than 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      const next = {
        ...details,
        profile: { ...details.profile, portraitDataUrl: reader.result },
      };
      onChange(next);
      setDraft(next.profile ?? {});
    });
    reader.readAsDataURL(file);
  }

  return (
    <>
      <section
        className="character-identity-bar"
        aria-label="Character identity"
      >
        <button
          type="button"
          className="character-portrait"
          onClick={() => uploadRef.current?.click()}
          aria-label="Upload character portrait"
          title="Upload character portrait"
        >
          {details.profile?.portraitDataUrl ? (
            <img src={details.profile.portraitDataUrl} alt="" />
          ) : (
            <span>{sheet.name.slice(0, 1).toUpperCase()}</span>
          )}
        </button>
        <input
          ref={uploadRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={(event) => readPortrait(event.target.files?.[0])}
        />
        <div className="character-identity-main">
          <span className="character-eyebrow">
            Character · Level {sheet.level}
          </span>
          <div className="character-identity-title">
            <h1>{sheet.name}</h1>
            <button
              type="button"
              className="character-edit-profile"
              onClick={openEditor}
            >
              Edit profile
            </button>
          </div>
          <p>
            {build.race.name} · {classSummary(build) || "No class levels"}
          </p>
        </div>
        <dl className="character-identity-facts">
          <div>
            <dt>Alignment</dt>
            <dd>{alignment}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{sheet.size}</dd>
          </div>
          <div>
            <dt>Deity</dt>
            <dd>{details.profile?.deity || "—"}</dd>
          </div>
        </dl>
        <div className={`character-vitals health-tone-${health.tone}`}>
          <span>Hit points</span>
          <strong>
            {currentHp}
            <small>
              {" "}
              / {sheet.hitPoints.total}
              {tempHp > 0 ? ` + ${tempHp} HP` : ""}
            </small>
          </strong>
          <span className="character-header-status">{health.label}</span>
        </div>
      </section>

      {editing ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setEditing(false)}
        >
          <section
            className="modal character-profile-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="character-profile-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="character-eyebrow">Identity &amp; flavor</span>
                <h2 id="character-profile-title">Character profile</h2>
              </div>
            </div>
            <p className="profile-dialog-intro">
              Personal details for {sheet.name}. These free-text fields do not
              change your character’s stats.
            </p>
            <div className="profile-field-sections">
              {[
                {
                  title: "Identity & origins",
                  keys: ["deity", "gender", "homeland", "associations"],
                },
                {
                  title: "Physical details",
                  keys: ["age", "height", "weight"],
                },
              ].map((group) => (
                <fieldset key={group.title}>
                  <legend>{group.title}</legend>
                  <div className="character-profile-grid">
                    {PROFILE_FIELDS.filter((field) =>
                      group.keys.includes(field.key),
                    ).map((field) => (
                      <label
                        className={`field compact profile-field-${field.key}`}
                        key={field.key}
                      >
                        <span>{field.label}</span>
                        <input
                          value={draft[field.key] ?? ""}
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange({ ...details, profile: draft });
                  setEditing(false);
                }}
              >
                Save profile
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
