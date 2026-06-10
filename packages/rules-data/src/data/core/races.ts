import type { RaceDefinition } from "../../types";

export const CORE_RACES: RaceDefinition[] = [
  {
    id: "human",
    name: "Human",
    pack: "core",
    size: "medium",
    speed: 30,
    abilityModifiers: [],
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    pack: "core",
    size: "medium",
    speed: 30,
    abilityModifiers: [
      { target: "str", type: "racial", value: 2, source: "Half-Orc", pack: "core" },
    ],
  },
  {
    id: "dwarf",
    name: "Dwarf",
    pack: "core",
    size: "medium",
    speed: 20,
    abilityModifiers: [
      { target: "con", type: "racial", value: 2, source: "Dwarf", pack: "core" },
      { target: "wis", type: "racial", value: 2, source: "Dwarf", pack: "core" },
      { target: "cha", type: "racial", value: -2, source: "Dwarf", pack: "core" },
    ],
  },
  {
    id: "elf",
    name: "Elf",
    pack: "core",
    size: "medium",
    speed: 30,
    abilityModifiers: [
      { target: "dex", type: "racial", value: 2, source: "Elf", pack: "core" },
      { target: "int", type: "racial", value: 2, source: "Elf", pack: "core" },
      { target: "con", type: "racial", value: -2, source: "Elf", pack: "core" },
    ],
  },
];
