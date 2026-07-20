import type { DerivedStat } from "@mathfinder/rules-engine";
import { sign } from "../util";
import { Tooltip } from "./Tooltip";

interface StatProps {
  label: string;
  stat: DerivedStat;
  /** When true, show the value as a raw number (no leading sign). */
  raw?: boolean;
}

/**
 * A single derived stat. Click to expand its full provenance breakdown —
 * the "why is this number what it is?" feature, working live.
 */
function breakdownTooltip(stat: DerivedStat, raw?: boolean) {
  const total = raw ? `${stat.total}` : sign(stat.total);
  const parts = stat.breakdown.map((b) => `${b.source}: ${sign(b.value)}`);
  return [`Total ${total}`, ...parts].join(" • ");
}

export function Stat({ label, stat, raw }: StatProps) {
  const display = raw ? `${stat.total}` : sign(stat.total);
  return (
    <details className="stat">
      <summary>
        <Tooltip content={breakdownTooltip(stat, raw)} className="inline-grow">
          <>
            <span className="stat-label">{label}</span>
            <span className="stat-value">{display}</span>
          </>
        </Tooltip>
      </summary>
      <ul className="breakdown">
        {stat.breakdown.map((b, i) => (
          <li key={i}>
            <span className="bd-source">
              {b.source}
              {b.type !== "base" && b.type !== "ability" ? (
                <span className="bd-type"> ({b.type})</span>
              ) : null}
            </span>
            <span className="bd-value">{sign(b.value)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
