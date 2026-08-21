import {
  applyCampaignRulesToWeapon,
  equipmentWeaponTemplate,
  type AbilityKey,
  type CharacterBuild,
} from "@mathfinder/rules-engine";
import {
  RUNTIME_ARCHETYPES,
  RUNTIME_ARMOR,
  RUNTIME_MUNDANE_EQUIPMENT,
  RUNTIME_RACE_OPTIONS,
  RUNTIME_WEAPONS,
  equipmentMagicItemTemplate,
  getRuntimeMagicItem,
} from "../content";

const ABILITY_ORDER: readonly AbilityKey[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];

function preferredFlexibleAbility(build: CharacterBuild) {
  const ranked = (
    Object.entries(build.baseAbilityScores) as [AbilityKey, number][]
  ).sort(
    (a, b) =>
      b[1] - a[1] || ABILITY_ORDER.indexOf(a[0]) - ABILITY_ORDER.indexOf(b[0]),
  );
  return ranked[0]?.[0] ?? "str";
}

function effectiveRaceChoiceOptions(
  race: CharacterBuild["race"],
  alternateTraitIds: string[],
) {
  const selectedIds = new Set(alternateTraitIds.map((id) => id.toLowerCase()));
  const activeTraits = (race.alternateTraits ?? []).filter((trait) =>
    selectedIds.has(trait.id.toLowerCase()),
  );
  const next = { ...(race.choiceOptions ?? {}) };
  for (const trait of activeTraits) {
    for (const key of trait.removeChoiceOptions ?? []) delete next[key];
    if (trait.choiceOptions?.flexibleAbilityBonus !== undefined)
      next.flexibleAbilityBonus = trait.choiceOptions.flexibleAbilityBonus;
    if (trait.choiceOptions?.bonusFeat !== undefined)
      next.bonusFeat = trait.choiceOptions.bonusFeat;
    if (trait.choiceOptions?.extraSkillRanksPerLevel !== undefined)
      next.extraSkillRanksPerLevel =
        trait.choiceOptions.extraSkillRanksPerLevel;
  }
  return next;
}

export function materializeRaceChoice(
  race: CharacterBuild["race"],
  build: CharacterBuild,
  previousRace?: CharacterBuild["race"],
): CharacterBuild["race"] {
  const validAlternateTraits = (
    previousRace?.choiceSelection?.alternateTraits ?? []
  ).filter(
    (id, index, entries) =>
      entries.findIndex((entry) => entry.toLowerCase() === id.toLowerCase()) ===
        index &&
      (race.alternateTraits ?? []).some(
        (trait) => trait.id.toLowerCase() === id.toLowerCase(),
      ),
  );
  const choiceOptions = effectiveRaceChoiceOptions(race, validAlternateTraits);
  const allowedAbilities =
    choiceOptions.flexibleAbilityBonus?.abilities ?? ABILITY_ORDER;
  const preservedFlexibleAbility =
    previousRace?.choiceSelection?.flexibleAbility;
  const flexibleAbility =
    preservedFlexibleAbility &&
    allowedAbilities.includes(preservedFlexibleAbility)
      ? preservedFlexibleAbility
      : choiceOptions.flexibleAbilityBonus
        ? preferredFlexibleAbility(build)
        : undefined;
  const bonusFeatOptions = choiceOptions.bonusFeat?.featOptions;
  const preservedBonusFeat = previousRace?.choiceSelection?.bonusFeat?.trim();
  const bonusFeat =
    preservedBonusFeat &&
    (!bonusFeatOptions?.length ||
      bonusFeatOptions.some(
        (feat) => feat.toLowerCase() === preservedBonusFeat.toLowerCase(),
      ))
      ? preservedBonusFeat
      : undefined;
  return {
    ...race,
    choiceSelection: {
      alternateTraits: validAlternateTraits,
      flexibleAbility: choiceOptions.flexibleAbilityBonus
        ? flexibleAbility && allowedAbilities.includes(flexibleAbility)
          ? flexibleAbility
          : allowedAbilities[0]
        : undefined,
      bonusFeat,
    },
  };
}

function normalizedSpellTriggerNames(names: string[] | undefined) {
  return (names ?? []).map((name) => name.trim()).filter(Boolean);
}

function normalizeEquipmentItem(
  item: NonNullable<CharacterBuild["equipment"]>[number],
): NonNullable<CharacterBuild["equipment"]>[number] {
  const defaults = {
    ownership: item.ownership ?? ("owned" as const),
    spellTriggerNames: normalizedSpellTriggerNames(item.spellTriggerNames),
  };
  if (!item.itemTemplateId) {
    return {
      ...item,
      ...defaults,
      kind: item.kind ?? "mundane",
      carryState: item.carryState ?? (item.equipped ? "carried" : "stowed"),
    };
  }

  const magicItem = getRuntimeMagicItem(item.itemTemplateId);
  if (magicItem) {
    const template = equipmentMagicItemTemplate(magicItem);
    return {
      ...item,
      ...defaults,
      kind: "magic",
      itemTemplateId: template.itemTemplateId,
      name: template.name,
      weight: template.weight,
      costGp: template.costGp,
      slot: template.slot,
      modifiers: template.modifiers,
    };
  }

  const armorItem = RUNTIME_ARMOR.find(
    (entry) => entry.id === item.itemTemplateId,
  );
  if (armorItem) {
    if (armorItem.categoryNormalized === "shield") {
      return {
        ...item,
        ...defaults,
        kind: "mundane",
        itemTemplateId: armorItem.id,
        name: armorItem.name,
        weight: armorItem.weightLb,
        costGp: armorItem.costGp,
        slot: "shield",
        modifiers: armorItem.modifiers,
        armor: undefined,
        shield: {
          acBonus: armorItem.armorBonus,
          checkPenalty:
            armorItem.armorCheckPenalty === undefined
              ? undefined
              : Math.abs(armorItem.armorCheckPenalty),
          rangedTouchShieldFraction: armorItem.rangedTouchShieldFraction,
        },
      };
    }
    return {
      ...item,
      ...defaults,
      kind: "mundane",
      itemTemplateId: armorItem.id,
      name: armorItem.name,
      weight: armorItem.weightLb,
      costGp: armorItem.costGp,
      slot: "armor",
      modifiers: armorItem.modifiers,
      shield: undefined,
      armor: armorItem.categoryNormalized
        ? {
            category: armorItem.categoryNormalized,
            acBonus: armorItem.armorBonus,
            maxDexBonus: armorItem.maxDexBonus,
            checkPenalty:
              armorItem.armorCheckPenalty === undefined
                ? undefined
                : Math.abs(armorItem.armorCheckPenalty),
            speedPenalty:
              typeof armorItem.speed30 === "number" &&
              typeof armorItem.speed20 === "number"
                ? armorItem.speed30 - armorItem.speed20
                : undefined,
            rangedTouchArmorFraction: armorItem.rangedTouchArmorFraction,
          }
        : undefined,
    };
  }

  const mundaneItem = RUNTIME_MUNDANE_EQUIPMENT.find(
    (entry) => entry.id === item.itemTemplateId,
  );
  if (mundaneItem) {
    return {
      ...item,
      ...defaults,
      kind: "mundane",
      carryState: item.carryState ?? (item.equipped ? "carried" : "stowed"),
      itemTemplateId: mundaneItem.id,
      name: mundaneItem.name,
      weight: mundaneItem.weightLb,
      costGp: mundaneItem.costGp,
      armor: undefined,
      shield: undefined,
    };
  }
  return { ...item, kind: item.kind ?? "mundane" };
}

export function normalizeBuild(build: CharacterBuild): CharacterBuild {
  const runtimeRace =
    RUNTIME_RACE_OPTIONS.find(
      ([, race]) =>
        race.name.trim().toLowerCase() === build.race.name.trim().toLowerCase(),
    )?.[1] ?? build.race;
  const normalizedRace = materializeRaceChoice(runtimeRace, build, build.race);
  const normalizedArchetypes = Object.fromEntries(
    Object.entries(build.classArchetypes ?? {})
      .map(([classKey, archetypeIds]) => {
        const validIds = [
          ...new Set(
            (archetypeIds ?? [])
              .map((id) => id.trim().toLowerCase())
              .filter((id) => {
                const archetype = RUNTIME_ARCHETYPES[id];
                return (
                  !!archetype &&
                  archetype.baseClassName.toLowerCase() ===
                    classKey.toLowerCase()
                );
              }),
          ),
        ];
        return [classKey.toLowerCase(), validIds];
      })
      .filter(([, ids]) => (ids as string[]).length > 0),
  );
  return {
    ...build,
    race: normalizedRace,
    classArchetypes: normalizedArchetypes,
    equipment: build.equipment?.map(normalizeEquipmentItem),
  };
}

export function runtimeWeaponOptions(
  campaignRules: CharacterBuild["campaignRules"],
) {
  return RUNTIME_WEAPONS.map((weapon) =>
    applyCampaignRulesToWeapon(weapon, campaignRules),
  );
}

export function syncTemplatedWeaponsToCampaignRules(
  build: CharacterBuild,
): CharacterBuild {
  const weaponById = new Map(
    runtimeWeaponOptions(build.campaignRules).map(
      (weapon) => [weapon.id, weapon] as const,
    ),
  );
  return {
    ...build,
    weapons: build.weapons?.map((weapon) => {
      const template = weapon.weaponTemplateId
        ? weaponById.get(weapon.weaponTemplateId)
        : undefined;
      if (!template) return weapon;
      return {
        ...weapon,
        weaponTemplateId: template.id,
        name: template.name,
        category: template.category,
        proficiencyGroup: template.proficiencyGroup,
        damageDice: template.damageDice,
        handedness: template.handedness,
        critRange: template.critRange,
        critMultiplier: template.critMultiplier,
        rangeIncrementFeet: template.rangeIncrementFeet,
        damageTypes: template.damageTypes,
        specialTags: template.specialTags,
        ammoType: template.ammoType,
        loadedAmmoType: undefined,
        ammoPerAttack: template.ammoPerAttack,
        reloadType: template.reloadType,
        firearmCategory: template.firearmCategory,
        weaponTechnology: template.weaponTechnology,
        attackModifier: template.attackModifier,
        extraDamageDice: template.extraDamageDice,
        ammoNotes: template.ammoNotes,
        ordnanceProfile: template.ordnanceProfile,
        misfire: template.misfire,
        targetsTouchAcWithinFirstRangeIncrement:
          template.targetsTouchAcWithinFirstRangeIncrement,
        damageAbility: template.damageAbility,
      };
    }),
    equipment: build.equipment?.map((item) => {
      const template =
        item.itemTemplateId && item.weapon
          ? weaponById.get(item.itemTemplateId)
          : undefined;
      if (!template) return item;
      const weaponTemplate = equipmentWeaponTemplate(template);
      return {
        ...item,
        name: weaponTemplate.name,
        weight: weaponTemplate.weight,
        costGp: weaponTemplate.costGp,
        weapon: weaponTemplate.weapon,
      };
    }),
  };
}
