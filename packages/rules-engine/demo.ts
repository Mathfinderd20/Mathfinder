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

const sheet = computeSheet(savageBerserkerL1);

console.log(renderSheet(sheet));
console.log("");
console.log("Why is AC 20?");
console.log("  " + explainStat(sheet.ac.normal));
console.log("Why is the melee attack what it is?");
console.log("  " + explainStat(sheet.attack.melee));
