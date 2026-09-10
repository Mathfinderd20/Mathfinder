import type { ReactNode } from "react";
import { useCharacterUiState } from "../features/characters/CharacterUiSession";

export function BuildSection({
  characterId,
  title,
  eyebrow,
  actions,
  children,
  className = "",
}: {
  characterId: string;
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useCharacterUiState(
    characterId,
    `build-section-${title}`,
    true,
  );
  return (
    <section className={`v2-panel ${className}`}>
      <header className="v2-panel-heading">
        <div>
          {eyebrow && <span className="character-eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        <div className="v2-inline-actions">
          {actions}
          <button
            type="button"
            className="ghost small"
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
            onClick={() => setOpen(!open)}
          >
            {open ? "−" : "+"}
          </button>
        </div>
      </header>
      <div hidden={!open}>{children}</div>
    </section>
  );
}
