import type { DerivedStat } from "@mathfinder/rules-engine";
import { sign } from "../util";

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
export function Stat({ label, stat, raw }: StatProps) {
  const display = raw ? `${stat.total}` : sign(stat.total);
  return (
    <details className="stat">
      <summary>
        <span className="stat-label">{label}</span>
        <span className="stat-value">{display}</span>
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
