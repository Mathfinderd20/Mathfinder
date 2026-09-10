import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildCharacter,
  computeSheet,
  deriveDeathRules,
} from "@mathfinder/rules-engine";
import { createFreshCharacterBuild } from "../features/characters/newCharacterBuild";
import { Sheet } from "./Sheet";

function renderSheet(currentHp = 9) {
  const build = createFreshCharacterBuild(
    "Test hero",
    {
      name: "Human",
      size: "medium",
      speed: 30,
      choiceOptions: {
        flexibleAbilityBonus: { value: 2 },
        extraSkillRanksPerLevel: 1,
      },
      notes: ["Languages: Common", "Immune to magical sleep", "Adaptable"],
      movementModes: { fly: 40, swim: 20, burrow: 10 },
    },
    {
      className: "Fighter",
      alignment: "true-neutral",
      hitPointRoll: 10,
      flexibleAbility: "str",
      baseAbilityScores: {
        str: 14,
        dex: 12,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
    },
  );
  const sheet = computeSheet(buildCharacter(build));
  return renderToStaticMarkup(
    <Sheet
      sheet={sheet}
      wealthSummary={{
        pp: 0,
        gp: 0,
        sp: 0,
        cp: 0,
        liquidWealthGp: 0,
        coinWeightLb: 0,
        gearCostGp: 0,
        wishlistCostGp: 0,
        totalWealthGp: 0,
      }}
      currentHp={currentHp}
      hpDamageTaken={1}
      tempHp={5}
      nonlethalDamage={0}
      stable={false}
      deathRules={deriveDeathRules(build)}
      diehardActive={false}
      ferocityUsed={false}
      onRest={() => undefined}
      campaignTraits={["Campaign survivor"]}
      showIdentity={false}
      showSpellcasting={false}
    />,
  );
}

describe("Character tab layout", () => {
  it("keeps an empty, collapsible Weapons section visible", () => {
    const html = renderSheet();
    expect(html).toContain("No weapons recorded.");
    expect(html).toContain('aria-label="Collapse Weapons"');
    expect(html).toContain(
      'aria-label="Collapse Feats &amp; Special Abilities"',
    );
  });
  it("keeps Disabled and strenuous action outside the persistent health manager", () => {
    const html = renderSheet(0);
    expect(html.indexOf("Take Strenuous Action")).toBeLessThan(
      html.indexOf("health-inline-summary"),
    );
    expect(html).toContain("True Death");
    expect(html).not.toContain(">Death at<");
    expect(html).toContain('class="health-manager-body" hidden=""');
    expect(html).toContain('aria-expanded="false">Manage Health</button>');
    expect(html).toContain("Melee Attack");
    expect(html).toContain("Ranged Attack");
  });
  it("keeps build-only racial bookkeeping out of the sheet", () => {
    const html = renderSheet();
    expect(html).not.toContain("Flexible racial bonus:");
    expect(html).not.toContain("Extra skill rank per level:");
    expect(html).toContain("Campaign survivor");
  });
  it("groups traits, senses, and defenses in their requested sections", () => {
    const html = renderSheet();
    const defense = html.slice(
      html.indexOf("sheet-defense-panel"),
      html.indexOf("sheet-combat-panel"),
    );
    const combat = html.slice(
      html.indexOf("sheet-combat-panel"),
      html.indexOf("sheet-reference-panel"),
    );
    const reference = html.slice(
      html.indexOf("sheet-reference-panel"),
      html.indexOf("sheet-inventory-panel"),
    );
    expect(defense).toContain("Immune to magical sleep");
    expect(combat).not.toContain("Adaptable");
    expect(reference).toContain("Adaptable");
    const skills = html.slice(html.indexOf("sheet-skills-panel"));
    expect(reference).not.toContain("Languages: Common");
    expect(skills).toContain("Languages: Common");
    expect(skills).toContain(
      '<details class="sheet-skill-details"><summary>Languages</summary>',
    );
    expect(skills).toContain(
      '<details class="sheet-skill-details"><summary>Senses</summary>',
    );
    expect(skills.indexOf("<summary>Languages</summary>")).toBeLessThan(
      skills.indexOf("<summary>Senses</summary>"),
    );
    expect(reference.match(/class="sheet-reference-group"/g)).toHaveLength(3);
    expect(combat).toContain("40 ft");
    expect(combat).toContain("20 ft");
    expect(combat).toContain("10 ft");
  });
  it("displays separate temporary HP and keeps Rest outside the health dropdown", () => {
    const html = renderSheet();
    expect(html).toContain(
      '<strong>9</strong> / 10<span class="health-temp"> + 5</span> HP',
    );
    expect(html.indexOf(">Rest</button>")).toBeLessThan(
      html.indexOf('class="health-manager-details'),
    );
    expect(html).toContain(">Revive</button>");
    expect(html).not.toContain("Reset / Revive");
  });
});
