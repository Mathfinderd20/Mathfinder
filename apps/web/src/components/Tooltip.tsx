import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content?: string;
  children: ReactNode;
  className?: string;
  trigger?: "hover" | "click";
}

export const TooltipTriggerContext = createContext<"hover" | "click">("hover");

interface TooltipPosition {
  left: number;
  top: number;
  below: boolean;
}

export function Tooltip({
  content,
  children,
  className = "",
  trigger,
}: TooltipProps) {
  const inheritedTrigger = useContext(TooltipTriggerContext);
  const clickToOpen = (trigger ?? inheritedTrigger) === "click";
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<TooltipPosition>();
  useEffect(() => {
    if (!clickToOpen || !position) return;
    function dismiss(event: PointerEvent) {
      if (
        !anchorRef.current?.contains(event.target as Node) &&
        !panelRef.current?.contains(event.target as Node)
      )
        setPosition(undefined);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPosition(undefined);
        anchorRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [clickToOpen, position]);
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
      ref={panelRef}
      className={`mf-tooltip-panel mf-tooltip-panel-portal ${clickToOpen ? "click-math-panel" : ""} ${position.below ? "below" : "above"}`}
      role={clickToOpen ? "dialog" : "tooltip"}
      aria-label={clickToOpen ? "Stat details" : undefined}
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
      role={clickToOpen ? "button" : undefined}
      tabIndex={clickToOpen ? 0 : undefined}
      aria-label={
        clickToOpen ? `Show details: ${content.split("\n")[0]}` : undefined
      }
      aria-expanded={clickToOpen ? !!position : undefined}
      onMouseEnter={clickToOpen ? undefined : showTooltip}
      onMouseLeave={clickToOpen ? undefined : () => setPosition(undefined)}
      onFocusCapture={clickToOpen ? undefined : showTooltip}
      onBlurCapture={clickToOpen ? undefined : handleBlur}
      onClick={
        clickToOpen
          ? (event) => {
              if (
                (event.target as Element).closest(
                  "button, input, select, summary, a",
                )
              )
                return;
              if (position) setPosition(undefined);
              else showTooltip();
            }
          : undefined
      }
      onKeyDown={
        clickToOpen
          ? (event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (position) setPosition(undefined);
                else showTooltip();
              }
            }
          : undefined
      }
    >
      {children}
      {panel && typeof document !== "undefined"
        ? createPortal(
            panel,
            anchorRef.current?.closest("dialog") ?? document.body,
          )
        : null}
    </span>
  );
}
