import type { AbilityKey, DerivedSheet } from "@path-builder/rules-engine";
import { sign } from "../util";
import { Stat } from "./Stat";

const ABILITY_ORDER: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

function compactByLevel(values: Partial<Record<number, number>>) {
  return Object.entries(values).map(([lvl, n]) => `L${lvl}:${n}`).join(" · ") || "—";
}

function compactSpellNames(values: Partial<Record<number, string[]>>) {
  return Object.entries(values).map(([lvl, names]) => `L${lvl}: ${(names ?? []).join(", ")}`).join(" · ") || "—";
}

/** The full read-only character sheet, rendered from a DerivedSheet. */
export function Sheet({ sheet }: { sheet: DerivedSheet }) {
  const rankedSkills = Object.values(sheet.skills)
    .filter((s) => s.ranks > 0 || s.isClassSkill)
    .sort((a, b) => a.name.localeCompare(b.name));

  const { race, classes, feats, features, suppressedFeatures } = sheet.descriptor;
  const classLine = classes.map((c) => `${c.name} ${c.level}`).join(" / ");
  const identity = [race, classLine].filter(Boolean).join(" · ");

  return (
    <div className="sheet paper-sheet">
      <section className="sheet-hero panel paper-panel">
        <div className="sheet-title-block">
          <div className="sheet-name-row">
            <h1>{sheet.name}</h1>
            <span className="paper-badge">Level {sheet.level}</span>
          </div>
          <div className="sheet-meta-line">
            <span>{identity || "Unspecified heroics"}</span>
            <span>Size: {sheet.size}</span>
            <span>Load: {sheet.encumbrance.band}</span>
          </div>
        </div>
        <div className="sheet-summary-grid">
          <div className="summary-box">
            <span className="summary-label">HP</span>
            <span className="summary-value">{sheet.hitPoints.total}</span>
          </div>
          <div className="summary-box">
            <span className="summary-label">AC</span>
            <span className="summary-value">{sheet.ac.normal.total}</span>
          </div>
          <div className="summary-box">
            <span className="summary-label">Initiative</span>
            <span className="summary-value">{sign(sheet.initiative.total)}</span>
          </div>
          <div className="summary-box">
            <span className="summary-label">Speed</span>
            <span className="summary-value">{sheet.speed.total} ft</span>
          </div>
        </div>
      </section>

      <section className="abilities paper-abilities panel paper-panel">
        {ABILITY_ORDER.map((key) => {
          const a = sheet.abilities[key];
          return (
            <div className="ability paper-ability" key={key}>
              <div className="ability-key">{key.toUpperCase()}</div>
              <div className="ability-score">{a.score}</div>
              <div className="ability-mod">{sign(a.mod)}</div>
            </div>
          );
        })}
      </section>

      <section className="panel paper-panel">
        <h2>Combat</h2>
        <div className="sheet-stat-grid sheet-stat-grid-compact">
          <div className="stat-card"><span className="summary-label">Base Attack</span><span className="summary-value">{sign(sheet.baseAttackBonus)}</span></div>
          <div className="stat-card"><span className="summary-label">Melee</span><span className="summary-value">{sign(sheet.attack.melee.total)}</span></div>
          <div className="stat-card"><span className="summary-label">Ranged</span><span className="summary-value">{sign(sheet.attack.ranged.total)}</span></div>
          <div className="stat-card"><span className="summary-label">CMB</span><span className="summary-value">{sign(sheet.cmb.total)}</span></div>
          <div className="stat-card"><span className="summary-label">CMD</span><span className="summary-value">{sheet.cmd.total}</span></div>
          <div className="stat-card"><span className="summary-label">Touch / FF</span><span className="summary-value">{sheet.ac.touch.total} / {sheet.ac.flatFooted.total}</span></div>
        </div>
      </section>

      <div className="sheet-sections">
        <section className="panel paper-panel">
          <h2>Defense</h2>
          <Stat label="Armor Class" stat={sheet.ac.normal} raw />
          <Stat label="Touch AC" stat={sheet.ac.touch} raw />
          <Stat label="Flat-Footed AC" stat={sheet.ac.flatFooted} raw />
          <Stat label="Fortitude" stat={sheet.saves.fort} />
          <Stat label="Reflex" stat={sheet.saves.ref} />
          <Stat label="Will" stat={sheet.saves.will} />
          <Stat label="Hit Points" stat={sheet.hitPoints} raw />
        </section>

        <section className="panel paper-panel">
          <h2>Offense & Movement</h2>
          <Stat label="Melee Attack" stat={sheet.attack.melee} />
          <Stat label="Ranged Attack" stat={sheet.attack.ranged} />
          <Stat label="Initiative" stat={sheet.initiative} />
          <Stat label="CMB" stat={sheet.cmb} />
          <Stat label="CMD" stat={sheet.cmd} raw />
          <Stat label="Speed" stat={sheet.speed} raw />
          <div className="stat static">
            <span className="stat-label">Encumbrance</span>
            <span className="stat-value smallcaps">{sheet.encumbrance.band}</span>
          </div>
        </section>
      </div>

      {sheet.weapons.length > 0 ? (
        <section className="panel paper-panel">
          <h2>Weapons</h2>
          <div className="weapons paper-table">
            {sheet.weapons.map((w, i) => (
              <div className="weapon" key={i}>
                <span className="weapon-name">{w.name}</span>
                <span className="weapon-stats">
                  <span className="weapon-atk">Atk {sign(w.attack.total)}</span>
                  <span className="weapon-dmg">Dmg {w.damageDisplay}</span>
                  <span className="weapon-crit">Crit {w.crit}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="sheet-sections sheet-sections-wide-right">
        <section className="panel paper-panel">
          <h2>Skills</h2>
          <div className="skills paper-skill-grid">
            {rankedSkills.map((s) => (
              <div className="skill" key={s.key}>
                <span className="skill-name">
                  {s.name}
                  {s.isClassSkill ? <span className="tag">class</span> : null}
                  {s.trainedOnly && !s.usable ? <span className="tag warn">untrained</span> : null}
                </span>
                <span className="skill-value">{sign(s.total)}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="sheet-stack">
          {(feats.length > 0 || features.length > 0 || suppressedFeatures.length > 0) ? (
            <section className="panel paper-panel">
              <h2>Feats & Special Abilities</h2>
              <div className="acquisitions">
                {features.map((f, i) => (
                  <span className="chip feature" key={`feat-${i}`}>
                    {f.name}
                    <span className="chip-lvl">L{f.level}</span>
                  </span>
                ))}
                {feats.map((f, i) => (
                  <span className="chip" key={`ft-${i}`}>
                    {f.name}
                    <span className="chip-lvl">L{f.level}</span>
                  </span>
                ))}
                {suppressedFeatures.map((f, i) => (
                  <span className="chip suppressed" key={`sup-${i}`} title={f.reason}>
                    {f.name}
                    <span className="chip-lvl">suppressed: {f.reason}</span>
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="panel paper-panel">
            <h2>Inventory</h2>
            <div className="sheet-stat-grid sheet-stat-grid-compact">
              <div className="stat-card"><span className="summary-label">Items</span><span className="summary-value">{sheet.inventory.itemCount}</span></div>
              <div className="stat-card"><span className="summary-label">Equipped</span><span className="summary-value">{sheet.inventory.equippedCount}</span></div>
              <div className="stat-card"><span className="summary-label">Weight</span><span className="summary-value">{sheet.inventory.totalWeight} lb</span></div>
              <div className="stat-card"><span className="summary-label">Cost</span><span className="summary-value">{sheet.inventory.totalCostGp} gp</span></div>
            </div>
          </section>
        </div>
      </div>

      {sheet.spellcasting.length > 0 ? (
        <section className="panel paper-panel">
          <h2>Spellcasting</h2>
          <div className="spell-sheet-grid">
            {sheet.spellcasting.map((c, i) => (
              <div className="spell-sheet-card" key={i}>
                <div className="editor-section-head tight">
                  <h3>{c.className}</h3>
                  <span className="paper-badge">{c.castingType}</span>
                </div>
                <div className="skills single-column-skills">
                  <div className="skill"><span className="skill-name">Caster Level</span><span className="skill-value">{c.casterLevel}</span></div>
                  <div className="skill"><span className="skill-name">Casting Stat</span><span className="skill-value">{c.castingAbility.toUpperCase()}</span></div>
                  <div className="skill"><span className="skill-name">Concentration</span><span className="skill-value">{sign(c.concentration.total)}</span></div>
                  <div className="skill"><span className="skill-name">Spells / Day</span><span className="skill-value">{compactByLevel(c.spellsPerDay)}</span></div>
                  <div className="skill"><span className="skill-name">Slots Left</span><span className="skill-value">{compactByLevel(c.slotsRemaining)}</span></div>
                  <div className="skill"><span className="skill-name">Bonus Slots</span><span className="skill-value">{compactByLevel(c.bonusSpellsPerDay)}</span></div>
                  <div className="skill"><span className="skill-name">Library</span><span className="skill-value">{compactSpellNames(c.librarySpells)}</span></div>
                  {c.castingType === "prepared" ? (
                    <>
                      <div className="skill"><span className="skill-name">Prep Capacity</span><span className="skill-value">{compactByLevel(c.preparedCapacity)}</span></div>
                      <div className="skill"><span className="skill-name">Prepared</span><span className="skill-value">{compactSpellNames(c.selectedPreparedSpells)}</span></div>
                    </>
                  ) : (
                    <>
                      <div className="skill"><span className="skill-name">Spells Known</span><span className="skill-value">{compactByLevel(c.spellsKnown)}</span></div>
                      <div className="skill"><span className="skill-name">Known Picks</span><span className="skill-value">{compactSpellNames(c.selectedKnownSpells)}</span></div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
