import {
  ALIGNMENTS,
  ALIGNMENT_LABELS,
  type Alignment,
} from "@mathfinder/rules-engine";

const ALIGNMENT_ABBREVIATIONS: Record<Alignment, string> = {
  "lawful-good": "LG",
  "neutral-good": "NG",
  "chaotic-good": "CG",
  "lawful-neutral": "LN",
  "true-neutral": "N",
  "chaotic-neutral": "CN",
  "lawful-evil": "LE",
  "neutral-evil": "NE",
  "chaotic-evil": "CE",
};

interface Props {
  value?: Alignment;
  onChange: (alignment: Alignment) => void;
  label?: string;
}

export function AlignmentPicker({
  value,
  onChange,
  label = "Alignment",
}: Props) {
  return (
    <div className="alignment-picker" role="radiogroup" aria-label={label}>
      {ALIGNMENTS.map((alignment) => {
        const selected = value === alignment;
        const fullName = ALIGNMENT_LABELS[alignment];
        return (
          <button
            key={alignment}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={fullName}
            title={fullName}
            className={`alignment-picker-option${selected ? " selected" : ""}`}
            onClick={() => onChange(alignment)}
          >
            {ALIGNMENT_ABBREVIATIONS[alignment]}
          </button>
        );
      })}
    </div>
  );
}
