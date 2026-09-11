import { useEffect, useRef, useState, type ReactNode } from "react";
import { CharacterDialog } from "./CharacterDialog";
import "./character-guide.css";

export interface GuideStep {
  id: string;
  label: string;
  title: string;
  description: string;
  optional?: boolean;
  errors?: string[];
}

/** All choices remain in the owner's draft until the review is confirmed. */
export function CharacterGuide({
  kind,
  title,
  subtitle,
  steps,
  step,
  onStep,
  onClose,
  onConfirm,
  confirmLabel,
  children,
  summary,
}: {
  kind: "creation" | "level-up";
  title: string;
  subtitle: string;
  steps: GuideStep[];
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  children: ReactNode;
  summary: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const current = steps[step]!;
  const review = step === steps.length - 1;
  const invalid = steps.flatMap((entry, index) =>
    (entry.errors ?? []).map((message) => ({ index, message })),
  );
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  function move(next: number) {
    setVisited((previous) => new Set([...previous, step]));
    onStep(next);
  }
  return (
    <CharacterDialog label={title} onClose={onClose}>
      <section className={`character-guide ${kind}-guide-dialog`}>
        <header className="guide-header">
          <div>
            <span className="guide-eyebrow">
              {kind === "creation"
                ? "Character creation"
                : "Guided character advancement"}
            </span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            type="button"
            className="ghost guide-close"
            aria-label="Close guide"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <nav
          className={`guide-steps ${kind === "creation" ? "creation-steps" : "level-up-steps"}`}
          aria-label={`${kind === "creation" ? "Creation" : "Level-up"} guide steps`}
        >
          {steps.map((entry, index) => (
            <button
              type="button"
              key={entry.id}
              aria-current={step === index ? "step" : undefined}
              className={`${step === index ? "active" : ""} ${visited.has(index) && !entry.errors?.length ? "complete" : ""}`}
              onClick={() => move(index)}
            >
              <b>
                {visited.has(index) && !entry.errors?.length && index !== step
                  ? "✓"
                  : index + 1}
              </b>
              <span>{entry.label}</span>
              {entry.optional && <em>Optional</em>}
            </button>
          ))}
        </nav>
        <div className="guide-context">{summary}</div>
        <main className="guide-body" key={current.id}>
          <span className="guide-eyebrow">
            Step {step + 1} of {steps.length}
            {current.optional ? " · Optional" : ""}
          </span>
          <h3 ref={heading} tabIndex={-1}>
            {current.title}
          </h3>
          <p className="guide-description">{current.description}</p>
          {children}
          {(review
            ? invalid
            : (current.errors ?? []).map((message) => ({
                index: step,
                message,
              }))
          ).length > 0 && (
            <div className="guide-errors" role="status">
              <strong>
                {review
                  ? "Finish these choices before saving"
                  : "Before continuing"}
              </strong>
              <ul>
                {(review
                  ? invalid
                  : (current.errors ?? []).map((message) => ({
                      index: step,
                      message,
                    }))
                ).map(({ index, message }) => (
                  <li key={`${index}:${message}`}>
                    {review && index !== step ? (
                      <button
                        type="button"
                        className="guide-error-link"
                        onClick={() => move(index)}
                      >
                        {steps[index]!.label}: {message}
                      </button>
                    ) : (
                      message
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>
        <footer className="guide-footer">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <span>
            {step + 1} / {steps.length}
          </span>
          {step > 0 && (
            <button
              type="button"
              className="ghost"
              onClick={() => move(step - 1)}
            >
              Back
            </button>
          )}
          <button
            type="button"
            className="guide-primary"
            disabled={review ? invalid.length > 0 : !!current.errors?.length}
            onClick={() => {
              if (review) {
                if (!invalid.length) onConfirm();
              } else move(step + 1);
            }}
          >
            {review ? confirmLabel : `Continue to ${steps[step + 1]!.label}`}
          </button>
        </footer>
      </section>
    </CharacterDialog>
  );
}
