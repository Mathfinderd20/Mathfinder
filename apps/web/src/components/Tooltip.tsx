import type { ReactNode } from "react";

interface TooltipProps {
  content?: string;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className = "" }: TooltipProps) {
  if (!content?.trim()) return <>{children}</>;
  const sections = content
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);
  return (
    <span className={`mf-tooltip ${className}`.trim()}>
      {children}
      <span className="mf-tooltip-panel" role="tooltip">
        {sections.map((section, index) => (
          <span key={`tooltip-section-${index}`} className="mf-tooltip-section">
            {section}
          </span>
        ))}
      </span>
    </span>
  );
}
