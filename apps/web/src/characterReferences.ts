import {
  referenceAbilityMechanics,
  getFeat,
  type ActivatableEffect,
  type ClassFeatureRegistry,
  type DerivedSheet,
  type FeatRegistry,
  type DerivedResourcePool,
  type ArchetypeDefinitionLike,
} from "@mathfinder/rules-engine";
import { partitionRaceNotes } from "./characterPresentation";

export interface CharacterReference {
  id: string;
  name: string;
  description: string;
  source: string;
  level?: number;
  suppressed?: string;
  activation?: ActivatableEffect;
  resourceId?: string;
  pool?: DerivedResourcePool;
  details: string[];
}

/** Only surface DC/dice actually supplied by the content; never invent mechanics. */
export function referenceDetails(description: string) {
  return [
    ...new Set(
      description.match(
        /\bDC\s+\d+(?:\s*\+\s*[^.;\n]+)?|\b\d+d\d+(?:\s*[+−-]\s*\d+)?/gi,
      ) ?? [],
    ),
  ];
}

export function characterReferences(
  sheet: DerivedSheet,
  campaignTraits: string[],
  features: ClassFeatureRegistry,
  feats: FeatRegistry,
  archetypes: Record<string, ArchetypeDefinitionLike> = {},
) {
  const ownedArchetypes = Object.values(archetypes).filter((entry) =>
    sheet.descriptor.archetypes.some(
      (owned) => owned.name.toLowerCase() === entry.name.toLowerCase(),
    ),
  );
  const featureDefinitions = sheet.descriptor.classes.flatMap(
    ({ name, level }) =>
      (features[name.toLowerCase()] ?? []).filter(
        (feature) => feature.level <= level,
      ),
  );
  function reference(
    name: string,
    level: number | undefined,
    kind: "Feats" | "Special Abilities",
    suppressed?: string,
  ): CharacterReference {
    const candidates = featureDefinitions
      .filter((feature) => feature.name.toLowerCase() === name.toLowerCase())
      .sort((a, b) => b.level - a.level);
    const definition = kind === "Feats" ? getFeat(feats, name) : candidates[0];
    const fullDescription =
      kind === "Feats"
        ? definition?.description
        : ([...candidates].sort(
            (a, b) => b.description.length - a.description.length,
          )[0]?.description ??
          ownedArchetypes.find((entry) => entry.name === name)?.description ??
          ownedArchetypes
            .flatMap((entry) => entry.features ?? [])
            .find((feature) => feature.name === name)?.summary);
    const activation =
      definition?.activatable ??
      candidates.find((feature) => feature.activatable)?.activatable;
    const description =
      fullDescription?.replace(/^\s*:\s*/, "") ||
      "Full rules text has not been supplied by this content source yet.";
    const mechanics = referenceAbilityMechanics(
      name,
      definition && "className" in definition
        ? definition.className
        : undefined,
      sheet,
    );
    return {
      id: `${kind}:${name}:${level ?? 0}`,
      name,
      description,
      level,
      source:
        definition && "className" in definition
          ? definition.className.replace(/\b\w/g, (letter) =>
              letter.toUpperCase(),
            )
          : kind === "Feats"
            ? "Feat"
            : "Special ability",
      suppressed,
      activation: suppressed ? undefined : activation,
      resourceId: suppressed
        ? undefined
        : (definition?.resourcePool?.id ??
          activation?.resourceCost?.poolId ??
          (activation?.resource ? activation.id : mechanics.pool?.id)),
      pool: suppressed ? undefined : mechanics.pool,
      details: mechanics.details.length
        ? mechanics.details
        : referenceDetails(description),
    };
  }
  function trait(
    text: string,
    index: number,
    source: string,
  ): CharacterReference {
    const separator = text.indexOf(":");
    const name = separator > 0 ? text.slice(0, separator).trim() : text;
    const known = reference(name, undefined, "Special Abilities");
    return {
      ...known,
      id: `${source}:${index}:${name}`,
      name,
      source,
      description:
        separator > 0 ? text.slice(separator + 1).trim() : known.description,
      details: referenceDetails(text),
    };
  }
  return [
    {
      name: "Traits",
      rows: [
        ...partitionRaceNotes(sheet.raceMetadata?.notes).traits.map(
          (text, index) => trait(text, index, "Racial trait"),
        ),
        ...campaignTraits
          .filter(Boolean)
          .map((text, index) => trait(text, index, "Campaign trait")),
      ],
    },
    {
      name: "Feats",
      rows: sheet.descriptor.feats.map((feat) =>
        reference(feat.name, feat.level, "Feats"),
      ),
    },
    {
      name: "Special Abilities",
      rows: [
        ...[...sheet.descriptor.archetypes, ...sheet.descriptor.features]
          .filter(
            (feature, index, all) =>
              !/^bonus feats?$/i.test(feature.name.trim()) &&
              all.findIndex((entry) => entry.name === feature.name) === index,
          )
          .map((feature) =>
            reference(feature.name, feature.level, "Special Abilities"),
          ),
        ...sheet.descriptor.suppressedFeatures.map((feature) =>
          reference(
            feature.name,
            feature.level,
            "Special Abilities",
            feature.reason,
          ),
        ),
      ],
    },
  ];
}

/** Spell duration trackers are not daily ability uses and must not be refilled by Rest. */
export function restorableAbilityResourceIds(
  resourceMaxes: Record<string, number>,
  spellEffectIds: string[],
) {
  const spellIds = new Set(spellEffectIds);
  return Object.keys(resourceMaxes).filter((id) => !spellIds.has(id));
}
