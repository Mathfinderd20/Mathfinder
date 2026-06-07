/**
 * Tiny demo: compute and print a character sheet.
 *
 *   node packages/rules-engine/demo.ts
 *
 * (Node 24+ runs TypeScript directly via type stripping.)
 */
import { computeSheet } from "./src/compute";
import { explainStat, renderSheet } from "./src/format";
import { savageBerserkerL1 } from "./test/fixtures/savage-berserker-l1";
import { buildCharacter, levelUp, type CharacterBuild } from "./src/build/character";

const sheet = computeSheet(savageBerserkerL1);

console.log(renderSheet(sheet));
console.log("");
console.log("Why is AC 20?");
console.log("  " + explainStat(sheet.ac.normal));
console.log("Why is the melee attack what it is?");
console.log("  " + explainStat(sheet.attack.melee));

console.log("\n\n=== LEVEL-UP DEMO ===\n");

let grukk: CharacterBuild = {
  name: "Grukk",
  race: {
    name: "Half-Orc",
    size: "medium",
    speed: 30,
    abilityModifiers: [{ target: "str", type: "racial", value: 2, source: "Half-Orc" }],
  },
  baseAbilityScores: { str: 14, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  levels: [
    {
      className: "Barbarian",
      hitPointRoll: 12,
      skillRanks: { climb: 1, perception: 1, intimidate: 1, survival: 1 },
      feats: ["Toughness"],
      modifiers: [{ target: "hp", type: "untyped", value: 3, source: "Toughness" }],
    },
  ],
};

console.log(renderSheet(computeSheet(buildCharacter(grukk))));

// Ding! Level 2.
grukk = levelUp(grukk, {
  className: "Barbarian",
  hitPointRoll: 7,
  skillRanks: { climb: 1, perception: 1, intimidate: 1, survival: 1 },
});

console.log("\n--- after leveling to 2 ---\n");
console.log(renderSheet(computeSheet(buildCharacter(grukk))));
