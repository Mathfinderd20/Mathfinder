import { useMemo, useState } from "react";
import type { AttackOutcome, CombatEventRecord } from "../runtimeState";

type CombatLogGroupMode = "time" | "type" | "weapon";

const EVENT_KIND_OPTIONS: Array<{
  kind: CombatEventRecord["kind"];
  label: string;
}> = [
  { kind: "attack", label: "Attacks" },
  { kind: "undo-attack", label: "Undo" },
  { kind: "reset-weapon-history", label: "History Resets" },
  { kind: "reset-ammo", label: "Ammo Resets" },
  { kind: "cast-spell", label: "Spell Casts" },
  { kind: "consume-spell-component", label: "Components" },
  { kind: "consume-spell-effect", label: "Spell Effects" },
  { kind: "apply-damage", label: "Damage" },
];

function formatEventTime(at: string) {
  return new Date(at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function eventKindLabel(kind: CombatEventRecord["kind"]) {
  return (
    EVENT_KIND_OPTIONS.find((option) => option.kind === kind)?.label ?? kind
  );
}

function outcomeLabel(outcome: AttackOutcome | undefined) {
  return outcome ? outcome.toUpperCase() : null;
}

function eventTitle(event: CombatEventRecord) {
  switch (event.kind) {
    case "attack":
      return `Attack · ${event.weaponName ?? "Unknown weapon"}`;
    case "undo-attack":
      return `Undo Attack · ${event.weaponName ?? "Unknown weapon"}`;
    case "reset-weapon-history":
      return `Reset History · ${event.weaponName ?? "Unknown weapon"}`;
    case "reset-ammo":
      return event.ammoType ? `Restock · ${event.ammoType}` : "Reset Ammo";
    case "cast-spell":
      return `Spell · ${event.spellName ?? "Unknown spell"}`;
    case "consume-spell-component":
      return `Component · ${event.spellName ?? event.itemName ?? "Tracked item"}`;
    case "consume-spell-effect":
      return `Spell Effect · ${event.effectName ?? event.effectId ?? "Tracked effect"}`;
    case "apply-damage":
      return `Damage · ${event.quantity ?? 0}`;
  }
}

function eventDetail(event: CombatEventRecord) {
  const ammoDelta = event.ammoDelta ?? 0;
  const outcome = outcomeLabel(event.outcome);
  const note = event.note ? ` · Note: ${event.note}` : "";
  if (event.kind === "cast-spell") {
    const spellName = event.spellName ?? "spell";
    const spellLevel = typeof event.spellLevel === "number" ? ` L${event.spellLevel}` : "";
    const classKey = event.classKey ? ` · ${event.classKey}` : "";
    return `cast ${spellName}${spellLevel}${classKey}${note}`;
  }
  if (event.kind === "consume-spell-component") {
    const quantity = Math.max(1, event.quantity ?? 1);
    const itemName = event.itemName ?? "tracked item";
    const spellName = event.spellName ?? "spell";
    return `consumed ${quantity} ${itemName}${quantity === 1 ? "" : "s"} for ${spellName}${note}`;
  }
  if (event.kind === "consume-spell-effect") {
    const quantity = Math.max(1, event.quantity ?? 1);
    return `spent ${quantity} from ${event.effectName ?? event.effectId ?? "tracked effect"}${note}`;
  }
  if (event.kind === "apply-damage") {
    return `${event.quantity ?? 0} ${event.damageType ?? "untyped"} damage${note ? note : ""}`;
  }
  if (event.ammoType && ammoDelta !== 0) {
    const verb = ammoDelta > 0 ? "spent" : "restored";
    return `${verb} ${Math.abs(ammoDelta)} ${event.ammoType}${Math.abs(ammoDelta) === 1 ? "" : "s"}${outcome ? ` · ${outcome}` : ""}${note}`;
  }
  if (event.kind === "reset-weapon-history")
    return "cleared recorded attacks for this weapon";
  if (event.kind === "reset-ammo")
    return event.ammoType
      ? `reset ${event.ammoType} consumption to full`
      : "reset all tracked ammo consumption";
  return `${outcome ? outcome : "no ammo tracked"}${note}`;
}

function groupTitle(event: CombatEventRecord, mode: CombatLogGroupMode) {
  switch (mode) {
    case "type":
      return eventKindLabel(event.kind);
    case "weapon":
      return (
        event.weaponName ??
        event.itemName ??
        (event.ammoType ? `Ammo · ${event.ammoType}` : "System")
      );
    case "time":
      return new Date(event.at).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
  }
}

export function CombatLogPanel({
  combatEventLog,
  onClearCombatEventLog,
}: {
  combatEventLog: CombatEventRecord[];
  onClearCombatEventLog?: () => void;
}) {
  const [groupMode, setGroupMode] = useState<CombatLogGroupMode>("time");
  const [visibleKinds, setVisibleKinds] = useState<
    Record<CombatEventRecord["kind"], boolean>
  >({
    attack: true,
    "undo-attack": true,
    "reset-weapon-history": true,
    "reset-ammo": true,
    "cast-spell": true,
    "consume-spell-component": true,
    "consume-spell-effect": true,
    "apply-damage": true,
  });

  const filteredEvents = useMemo(
    () => combatEventLog.filter((event) => visibleKinds[event.kind]),
    [combatEventLog, visibleKinds],
  );

  const groupedEvents = useMemo(() => {
    const newestFirst = filteredEvents.slice().reverse();
    const groups: Array<{
      key: string;
      title: string;
      events: CombatEventRecord[];
    }> = [];
    for (const event of newestFirst) {
      const title = groupTitle(event, groupMode);
      const key = `${groupMode}:${title}`;
      const existing = groups[groups.length - 1];
      if (existing?.key === key) {
        existing.events.push(event);
        continue;
      }
      groups.push({ key, title, events: [event] });
    }
    return groups;
  }, [filteredEvents, groupMode]);

  function toggleKind(kind: CombatEventRecord["kind"]) {
    setVisibleKinds((prev) => ({ ...prev, [kind]: !prev[kind] }));
  }

  function showAllKinds() {
    setVisibleKinds({
      attack: true,
      "undo-attack": true,
      "reset-weapon-history": true,
      "reset-ammo": true,
      "cast-spell": true,
      "consume-spell-component": true,
      "consume-spell-effect": true,
      "apply-damage": true,
    });
  }

  const allKindsVisible = Object.values(visibleKinds).every(Boolean);

  return (
    <section className="panel paper-panel">
      <div className="editor-section-head tight">
        <h2>Combat Log</h2>
        {onClearCombatEventLog ? (
          <button
            className="ghost small"
            disabled={combatEventLog.length <= 0}
            onClick={() => onClearCombatEventLog()}
          >
            Clear Log
          </button>
        ) : null}
      </div>
      {combatEventLog.length <= 0 ? (
        <p className="hint">No combat events yet. Go bonk something.</p>
      ) : (
        <>
          <p className="hint">
            Filter the chaos, group the chaos, pretend the chaos was organized
            the whole time.
          </p>
          <div className="combat-log-controls">
            <div className="combat-log-control-block">
              <span className="combat-log-control-label">Filter</span>
              <div className="combat-log-filter-row">
                {EVENT_KIND_OPTIONS.map((option) => (
                  <button
                    key={option.kind}
                    className={`ghost small combat-log-filter-button${visibleKinds[option.kind] ? " active" : ""}`}
                    onClick={() => toggleKind(option.kind)}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  className="ghost small"
                  disabled={allKindsVisible}
                  onClick={showAllKinds}
                >
                  Show All
                </button>
              </div>
            </div>
            <div className="combat-log-control-block">
              <span className="combat-log-control-label">Group By</span>
              <div className="combat-log-filter-row">
                {(
                  [
                    ["time", "Day"],
                    ["type", "Type"],
                    ["weapon", "Weapon"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    className={`ghost small combat-log-filter-button${groupMode === mode ? " active" : ""}`}
                    onClick={() => setGroupMode(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="hint">
            Showing {filteredEvents.length} of {combatEventLog.length} events.
          </p>
          {filteredEvents.length <= 0 ? (
            <p className="hint">
              No events match the current filters. Incredible. You filtered
              reality away.
            </p>
          ) : (
            <div className="combat-log-groups">
              {groupedEvents.map((group) => (
                <div className="combat-log-group" key={group.key}>
                  <div className="combat-log-group-head">
                    <strong>{group.title}</strong>
                    <span className="combat-log-time">
                      {group.events.length} event
                      {group.events.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="combat-log-list">
                    {group.events.map((event) => (
                      <div className="combat-log-item" key={event.id}>
                        <div className="combat-log-head">
                          <strong>{eventTitle(event)}</strong>
                          <div className="combat-log-head-right">
                            {event.outcome ? (
                              <span className={`tag outcome ${event.outcome}`}>
                                {event.outcome}
                              </span>
                            ) : null}
                            <span className="combat-log-time">
                              {formatEventTime(event.at)}
                            </span>
                          </div>
                        </div>
                        <div className="combat-log-detail">
                          {eventDetail(event)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
