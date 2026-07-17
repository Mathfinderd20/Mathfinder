import type { EidolonSubtypeDefinition } from "../../types";

export const SAVAGE_COMPANY_EIDOLON_SUBTYPES: EidolonSubtypeDefinition[] = [
  {
    id: "warmachine",
    name: "Warmachine",
    pack: "savage-company",
    description:
      "A construct-inflected artillery eidolon subtype built around cannons, scaling bulk, and vehicle-style upgrade flavor.",
    baseForm: "Biped (limbs [cannons], limbs [legs], slam)",
    baseEvolutions: [
      "Counts as both construct and outsider for bane, favored enemy, and similar effects.",
      "No Constitution score; gains bonus hit points for construct size.",
      "Cannon evolution: 120-foot ranged touch primary natural attack dealing 1d6 bludgeoning and piercing damage; ammo is self-manifested, never misfires, and never reloads.",
    ],
    progression: [
      {
        level: 4,
        name: "Energy Attacks",
        summary: "Cannons gain the energy attacks evolution.",
      },
      {
        level: 8,
        name: "Large Mount",
        summary:
          "Gain Large and Mount evolutions; cannon base damage increases to 1d10.",
      },
      {
        level: 12,
        name: "Automatic Cannons",
        summary: "Gain DR 5/adamantine and automatic quality on cannons.",
      },
      {
        level: 13,
        name: "Huge Frame",
        summary:
          "Gain Large again to become Huge; cannon base damage increases to 2d8.",
      },
      {
        level: 15,
        name: "Additional Cannon",
        summary: "May evolve an extra cannon for a 2-point evolution cost.",
      },
      {
        level: 18,
        name: "Speed Cannons",
        summary:
          "Cannons increase to 3d8 damage and gain an extra speed-like attack.",
      },
    ],
    notes: [
      "Dominus archetypes use this subtype and receive only half normal evolution points, minimum 1.",
    ],
  },
];
