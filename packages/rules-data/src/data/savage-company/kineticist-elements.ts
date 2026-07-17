import type { KineticistElementDefinition } from "../../types";

export const SAVAGE_COMPANY_KINETICIST_ELEMENTS: KineticistElementDefinition[] =
  [
    {
      id: "lodestone",
      name: "Lodestone",
      pack: "savage-company",
      description:
        "A magnetokineticist element focused on metal manipulation, magnetic propulsion, and storm-like defensive chaff.",
      basicManipulation:
        "Basic magnetokinesis: move metal or metal-bearing material up to 5 pounds per level within 15 feet, or detect metal at range.",
      simpleBlast:
        "Metal Blast: a physical blast of manipulated metal dealing bludgeoning, piercing, or slashing damage.",
      defense:
        "Storm of Steel: gain a scaling deflection bonus to AC and lash adjacent creatures with metal blasts when accepting burn.",
      infusions: [
        "Pushing Infusion",
        "Pulling Infusion",
        "Bowling Infusion",
        "Impale",
        "Magnetic Infusion",
        "Rare Metal Infusion",
        "Flaying Infusion",
        "Fragmentation",
      ],
      utilityTalents: [
        "Basic Magnetokinesis",
        "Magnetic Fury",
        "Kinetic Cover",
        "Steel Will",
        "Metal Flesh",
        "Magnetic Control",
        "Steelsight",
        "Magnetic Control, Greater",
        "Metal Puppet",
        "Shard Shield",
        "Steel Deflection",
        "Magnetic Deflection",
        "Magnetic Master",
        "Warformed",
      ],
      notes: [
        "Includes a saturation process for attuning the body to battlefield metal over 24 hours.",
        "Warformed grants DR 3/- and enables basic lodestone talents in areas otherwise devoid of metal.",
      ],
    },
  ];
