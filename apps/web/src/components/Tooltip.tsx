import { useRef, useState, type FocusEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content?: string;
  children: ReactNode;
  className?: string;
}

interface TooltipPosition {
  left: number;
  top: number;
  below: boolean;
}

export function Tooltip({ content, children, className = "" }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<TooltipPosition>();
  if (!content?.trim()) return <>{children}</>;

  const sections = content
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);

  function showTooltip() {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") return;
    const rect = anchor.getBoundingClientRect();
    const tooltipWidth = Math.min(380, Math.max(160, window.innerWidth - 32));
    const halfWidth = tooltipWidth / 2;
    setPosition({
      left: Math.min(
        window.innerWidth - halfWidth - 8,
        Math.max(halfWidth + 8, rect.left + rect.width / 2),
      ),
      top: rect.top < 180 ? rect.bottom + 10 : rect.top - 10,
      below: rect.top < 180,
    });
  }

  function handleBlur(event: FocusEvent<HTMLSpanElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setPosition(undefined);
    }
  }

  const panel = position ? (
    <span
      className={`mf-tooltip-panel mf-tooltip-panel-portal ${position.below ? "below" : "above"}`}
      role="tooltip"
      style={{ left: position.left, top: position.top }}
    >
      {sections.map((section, index) => (
        <span key={`tooltip-section-${index}`} className="mf-tooltip-section">
          {section}
        </span>
      ))}
    </span>
  ) : null;

  return (
    <span
      ref={anchorRef}
      className={`mf-tooltip ${className}`.trim()}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setPosition(undefined)}
      onFocusCapture={showTooltip}
      onBlurCapture={handleBlur}
    >
      {children}
      {panel && typeof document !== "undefined"
        ? createPortal(panel, document.body)
        : null}
    </span>
  );
}
