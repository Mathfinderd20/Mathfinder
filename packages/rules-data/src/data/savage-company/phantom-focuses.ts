import type { PhantomEmotionalFocusDefinition } from "../../types";

export const SAVAGE_COMPANY_PHANTOM_FOCUSES: PhantomEmotionalFocusDefinition[] =
  [
    {
      id: "resolute",
      name: "Resolute",
      pack: "savage-company",
      description:
        "A stoic, duty-bound phantom focus built for armored aggression, steadfast defense, and terrifying last stands.",
      skills: ["Intimidate", "Craft (armor)"],
      goodSaves: ["Fortitude", "Will"],
      abilityAdjustments:
        "+2 Strength, -2 Dexterity; later level-based bonuses improve Strength instead of Dexterity.",
      powers: [
        {
          level: 1,
          name: "Resolute Weapon",
          summary:
            "Slam attacks deal 1d10 slashing damage with an 18–20 critical threat range, increasing to 2d8 at 13th.",
        },
        {
          level: 7,
          name: "Resolute Aura",
          summary:
            "As a swift action, emit a 10-foot aura letting allies under mind-affecting effects use the phantom’s Will save to attempt escape.",
        },
        {
          level: 12,
          name: "Fearsome Dedication",
          summary:
            "Once per day in ectoplasmic form, enlarge and rage for 1 round per spiritualist level; later also gains frightful presence at 18th.",
        },
        {
          level: 17,
          name: "Resolute Demise",
          summary:
            "When banished by hit point loss, the phantom may make a free deathstroke critical that can outright kill the foe.",
        },
      ],
    },
  ];
