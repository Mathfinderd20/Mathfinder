import type { CharacterInput, Modifier, Size } from "./types";
import { deriveAbilities } from "./abilities";

const SIZES: Size[] = [
  "fine",
  "diminutive",
  "tiny",
  "small",
  "medium",
  "large",
  "huge",
  "gargantuan",
  "colossal",
];
const DAMAGE_STEPS = [
  "1",
  "1d2",
  "1d3",
  "1d4",
  "1d6",
  "1d8",
  "1d10",
  "2d6",
  "2d8",
  "3d6",
  "3d8",
  "4d6",
  "4d8",
  "6d6",
  "6d8",
  "8d6",
  "8d8",
  "12d6",
  "12d8",
  "16d6",
  "16d8",
  "24d6",
  "24d8",
];

/** Core FAQ: paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9t3f.
 * A size category is one or two dice-chart steps depending on starting size.
 * Unknown custom expressions are left intact for GM adjudication.
 */
export function resizePersonWeaponDice(
  dice: string,
  initialSize: Size,
  direction: number,
) {
  if (dice === "2d10") return direction > 0 ? "4d8" : "2d8";
  const aliases: Record<string, string> = {
    "2d4": "1d8",
    "3d4": "2d6",
    "4d4": "2d8",
    "1d12": "2d6",
    "2d12": "4d6",
  };
  const index = DAMAGE_STEPS.indexOf(aliases[dice] ?? dice);
  if (index < 0) return dice;
  const sizeIndex = SIZES.indexOf(initialSize);
  const steps =
    direction > 0
      ? sizeIndex <= 3 || index <= 4
        ? 1
        : 2
      : sizeIndex <= 4 || index <= 5
        ? 1
        : 2;
  return DAMAGE_STEPS[Math.max(0, index + direction * steps)] ?? dice;
}

/** Apply the two core Person size spells to a copy of the race/Codex-derived input.
 * Tables: Core Rulebook, Enlarge Person / Reduce Person and weapon size damage.
 * Duplicates do not stack; conflicting imported effects cancel defensively.
 */
export function applyPersonSizeEffects(input: CharacterInput): CharacterInput {
  const effects = input.modifiers.filter(
    (modifier) =>
      modifier.target === "size.person" && modifier.enabled !== false,
  );
  const grow = effects.some((modifier) => modifier.value > 0);
  const shrink = effects.some((modifier) => modifier.value < 0);
  const direction = Number(grow) - Number(shrink);
  if (!direction) return input;
  const index = SIZES.indexOf(input.size);
  const nextIndex = Math.max(0, Math.min(SIZES.length - 1, index + direction));
  if (nextIndex === index) return input;
  const abilities = deriveAbilities(input);
  const source = direction > 0 ? "Enlarge Person" : "Reduce Person";
  const penaltyAbility = direction > 0 ? "dex" : "str";
  const adjustments: Modifier[] = [
    { target: direction > 0 ? "str" : "dex", type: "size", value: 2, source },
    {
      target: penaltyAbility,
      type: "size",
      value: -Math.min(2, Math.max(0, abilities[penaltyAbility].score - 1)),
      source,
    },
  ];
  // Relative deltas preserve racial size bonuses already present in content.
  const stealth = [16, 12, 8, 4, 0, -4, -8, -12, -16];
  const fly = [8, 6, 4, 2, 0, -2, -4, -6, -8];
  adjustments.push(
    {
      target: "skill.stealth",
      type: "untyped",
      value: stealth[nextIndex]! - stealth[index]!,
      source,
    },
    {
      target: "skill.fly",
      type: "untyped",
      value: fly[nextIndex]! - fly[index]!,
      source,
    },
  );
  return {
    ...input,
    size: SIZES[nextIndex]!,
    modifiers: [...input.modifiers, ...adjustments],
    weapons: input.weapons?.map((weapon) => {
      // Enlarge projectiles revert on release. Reduce affects projectile weapons,
      // but thrown weapons revert. Ammunition identifies a projectile weapon.
      const resize =
        weapon.category === "melee" || (direction < 0 && !!weapon.ammoType);
      return resize
        ? {
            ...weapon,
            damageDice: resizePersonWeaponDice(
              weapon.damageDice,
              input.size,
              direction,
            ),
          }
        : weapon;
    }),
  };
}
