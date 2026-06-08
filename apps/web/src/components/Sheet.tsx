import type { AbilityKey, DerivedSheet } from "@path-builder/rules-engine";
import { sign } from "../util";
import { Stat } from "./Stat";

const ABILITY_ORDER: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

/** The full read-only character sheet, rendered from a DerivedSheet. */
export function Sheet({ sheet }: { sheet: DerivedSheet }) {
  const rankedSkills = Object.values(sheet.skills)
    .filter((s) => s.ranks > 0 || s.isClassSkill)
    .sort((a, b) => a.name.localeCompare(b.name));

  const { race, classes, feats, features } = sheet.descriptor;
  const classLine = classes.map((c) => `${c.name} ${c.level}`).join(" / ");
  const identity = [race, classLine].filter(Boolean).join(" ");

  return (
    <div className="sheet">
      <div className="sheet-header">
        <h1>{sheet.name}</h1>
        <span className="subtitle">
          {identity ? `${identity} · ` : ""}
          {sheet.size}
        </span>
      </div>

      <div className="abilities">
        {ABILITY_ORDER.map((key) => {
          const a = sheet.abilities[key];
          return (
            <div className="ability" key={key}>
              <div className="ability-key">{key.toUpperCase()}</div>
              <div className="ability-score">{a.score}</div>
              <div className="ability-mod">{sign(a.mod)}</div>
            </div>
          );
        })}
      </div>

      <div className="columns">
        <section className="panel">
          <h2>Defense</h2>
          <Stat label="AC" stat={sheet.ac.normal} raw />
          <Stat label="Touch" stat={sheet.ac.touch} raw />
          <Stat label="Flat-Footed" stat={sheet.ac.flatFooted} raw />
          <Stat label="Fortitude" stat={sheet.saves.fort} />
          <Stat label="Reflex" stat={sheet.saves.ref} />
          <Stat label="Will" stat={sheet.saves.will} />
          <Stat label="Hit Points" stat={sheet.hitPoints} raw />
        </section>

        <section className="panel">
          <h2>Offense &amp; Movement</h2>
          <div className="stat static">
            <span className="stat-label">Base Attack</span>
            <span className="stat-value">{sign(sheet.baseAttackBonus)}</span>
          </div>
          <Stat label="Melee" stat={sheet.attack.melee} />
          <Stat label="Ranged" stat={sheet.attack.ranged} />
          <Stat label="CMB" stat={sheet.cmb} />
          <Stat label="CMD" stat={sheet.cmd} raw />
          <Stat label="Initiative" stat={sheet.initiative} />
          <Stat label="Speed (ft)" stat={sheet.speed} raw />
          <div className="stat static">
            <span className="stat-label">Load</span>
            <span className="stat-value smallcaps">{sheet.encumbrance.band}</span>
          </div>
        </section>
      </div>

      {sheet.weapons.length > 0 ? (
        <section className="panel">
          <h2>Weapons</h2>
          <div className="weapons">
            {sheet.weapons.map((w, i) => (
              <div className="weapon" key={i}>
                <span className="weapon-name">{w.name}</span>
                <span className="weapon-stats">
                  <span className="weapon-atk">{sign(w.attack.total)}</span>
                  <span className="weapon-dmg">{w.damageDisplay}</span>
                  <span className="weapon-crit">{w.crit}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {feats.length > 0 || features.length > 0 ? (
        <section className="panel">
          <h2>Feats &amp; Special Abilities</h2>
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
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>Skills</h2>
        <div className="skills">
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
    </div>
  );
}
