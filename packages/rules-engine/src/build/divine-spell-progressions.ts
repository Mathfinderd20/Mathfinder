/** Core PF1 spell slots, excluding cleric domain slots.
 * Sources:
 * https://legacy.aonprd.com/coreRuleBook/classes/cleric.html
 * https://legacy.aonprd.com/coreRuleBook/classes/druid.html
 * https://legacy.aonprd.com/coreRuleBook/classes/paladin.html
 * https://legacy.aonprd.com/coreRulebook/classes/ranger.html
 * Missing entries mean locked; zero means unlocked with bonus slots only.
 */
function progression(
  rows: number[][],
  firstClassLevel: number,
  firstSpellLevel: number,
) {
  return Object.fromEntries(
    rows.map((row, index) => [
      firstClassLevel + index,
      Object.fromEntries(
        row.map((slots, level) => [firstSpellLevel + level, slots]),
      ),
    ]),
  );
}

export const FULL_DIVINE_SPELLS_PER_DAY = progression(
  [
    [3, 1],
    [4, 2],
    [4, 2, 1],
    [4, 3, 2],
    [4, 3, 2, 1],
    [4, 3, 3, 2],
    [4, 4, 3, 2, 1],
    [4, 4, 3, 3, 2],
    [4, 4, 4, 3, 2, 1],
    [4, 4, 4, 3, 3, 2],
    [4, 4, 4, 4, 3, 2, 1],
    [4, 4, 4, 4, 3, 3, 2],
    [4, 4, 4, 4, 4, 3, 2, 1],
    [4, 4, 4, 4, 4, 3, 3, 2],
    [4, 4, 4, 4, 4, 4, 3, 2, 1],
    [4, 4, 4, 4, 4, 4, 3, 3, 2],
    [4, 4, 4, 4, 4, 4, 4, 3, 2, 1],
    [4, 4, 4, 4, 4, 4, 4, 3, 3, 2],
    [4, 4, 4, 4, 4, 4, 4, 4, 3, 3],
    [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  ],
  1,
  0,
);

export const MARTIAL_DIVINE_SPELLS_PER_DAY = progression(
  [
    [0],
    [1],
    [1],
    [1, 0],
    [1, 1],
    [2, 1],
    [2, 1, 0],
    [2, 1, 1],
    [2, 2, 1],
    [3, 2, 1, 0],
    [3, 2, 1, 1],
    [3, 2, 2, 1],
    [3, 3, 2, 1],
    [4, 3, 2, 1],
    [4, 3, 2, 2],
    [4, 3, 3, 2],
    [4, 4, 3, 3],
  ],
  4,
  1,
);
