import type { RulesDataSet, RulesPack, ValidationIssue } from "./types";

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pushDuplicateIssues(
  issues: ValidationIssue[],
  path: string,
  names: string[],
) {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key))
      issues.push({ path, message: `Duplicate name: ${name}` });
    else seen.add(key);
  }
}

function validatePack(pack: RulesPack, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!hasText(pack.id))
    issues.push({ path: `${path}.id`, message: "Pack id is required." });
  if (!hasText(pack.name))
    issues.push({ path: `${path}.name`, message: "Pack name is required." });
  if (!hasText(pack.sourceId))
    issues.push({
      path: `${path}.sourceId`,
      message: "Pack sourceId is required.",
    });
  if (!hasText(pack.version))
    issues.push({
      path: `${path}.version`,
      message: "Pack version is required.",
    });

  const classes = pack.classes ?? [];
  const archetypes = pack.archetypes ?? [];
  const bloodlines = pack.bloodlines ?? [];
  const kineticistElements = pack.kineticistElements ?? [];
  const phantomEmotionalFocuses = pack.phantomEmotionalFocuses ?? [];
  const eidolonSubtypes = pack.eidolonSubtypes ?? [];
  const hexes = pack.hexes ?? [];
  const blessings = pack.blessings ?? [];
  const trapOptions = pack.trapOptions ?? [];
  const buildGuides = pack.buildGuides ?? [];
  const feats = pack.feats ?? [];
  const races = pack.races ?? [];
  const skills = pack.skills ?? [];
  const spells = pack.spells ?? [];
  const weapons = pack.weapons ?? [];
  const magicItems = pack.magicItems ?? [];
  const domains = pack.domains ?? [];
  const schools = pack.schools ?? [];
  const spellEffects = pack.spellEffects ?? [];

  pushDuplicateIssues(
    issues,
    `${path}.classes`,
    classes.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.archetypes`,
    archetypes.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.bloodlines`,
    bloodlines.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.kineticistElements`,
    kineticistElements.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.phantomEmotionalFocuses`,
    phantomEmotionalFocuses.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.eidolonSubtypes`,
    eidolonSubtypes.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.hexes`,
    hexes.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.blessings`,
    blessings.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.trapOptions`,
    trapOptions.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.buildGuides`,
    buildGuides.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.feats`,
    feats.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.races`,
    races.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.skills`,
    skills.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.spells`,
    spells.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.weapons`,
    weapons.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.magicItems`,
    magicItems.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.domains`,
    domains.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.schools`,
    schools.map((item) => item.name),
  );
  pushDuplicateIssues(
    issues,
    `${path}.spellEffects`,
    spellEffects.map((item) => item.id),
  );

  for (const [index, archetype] of archetypes.entries()) {
    if (!hasText(archetype.id))
      issues.push({
        path: `${path}.archetypes[${index}].id`,
        message: "Archetype id is required.",
      });
    if (!hasText(archetype.pack))
      issues.push({
        path: `${path}.archetypes[${index}].pack`,
        message: "Archetype pack is required.",
      });
    if (!hasText(archetype.baseClassName))
      issues.push({
        path: `${path}.archetypes[${index}].baseClassName`,
        message: "Archetype baseClassName is required.",
      });
    if (!hasText(archetype.description))
      issues.push({
        path: `${path}.archetypes[${index}].description`,
        message: "Archetype description is required.",
      });
  }
  for (const [index, bloodline] of bloodlines.entries()) {
    if (!hasText(bloodline.id))
      issues.push({
        path: `${path}.bloodlines[${index}].id`,
        message: "Bloodline id is required.",
      });
    if (!hasText(bloodline.pack))
      issues.push({
        path: `${path}.bloodlines[${index}].pack`,
        message: "Bloodline pack is required.",
      });
  }
  for (const [index, element] of kineticistElements.entries()) {
    if (!hasText(element.id))
      issues.push({
        path: `${path}.kineticistElements[${index}].id`,
        message: "Kineticist element id is required.",
      });
    if (!hasText(element.pack))
      issues.push({
        path: `${path}.kineticistElements[${index}].pack`,
        message: "Kineticist element pack is required.",
      });
  }
  for (const [index, focus] of phantomEmotionalFocuses.entries()) {
    if (!hasText(focus.id))
      issues.push({
        path: `${path}.phantomEmotionalFocuses[${index}].id`,
        message: "Phantom emotional focus id is required.",
      });
    if (!hasText(focus.pack))
      issues.push({
        path: `${path}.phantomEmotionalFocuses[${index}].pack`,
        message: "Phantom emotional focus pack is required.",
      });
  }
  for (const [index, subtype] of eidolonSubtypes.entries()) {
    if (!hasText(subtype.id))
      issues.push({
        path: `${path}.eidolonSubtypes[${index}].id`,
        message: "Eidolon subtype id is required.",
      });
    if (!hasText(subtype.pack))
      issues.push({
        path: `${path}.eidolonSubtypes[${index}].pack`,
        message: "Eidolon subtype pack is required.",
      });
  }
  for (const [index, hex] of hexes.entries()) {
    if (!hasText(hex.id))
      issues.push({
        path: `${path}.hexes[${index}].id`,
        message: "Hex id is required.",
      });
    if (!hasText(hex.pack))
      issues.push({
        path: `${path}.hexes[${index}].pack`,
        message: "Hex pack is required.",
      });
  }
  for (const [index, blessing] of blessings.entries()) {
    if (!hasText(blessing.id))
      issues.push({
        path: `${path}.blessings[${index}].id`,
        message: "Blessing id is required.",
      });
    if (!hasText(blessing.pack))
      issues.push({
        path: `${path}.blessings[${index}].pack`,
        message: "Blessing pack is required.",
      });
  }
  for (const [index, trap] of trapOptions.entries()) {
    if (!hasText(trap.id))
      issues.push({
        path: `${path}.trapOptions[${index}].id`,
        message: "Trap option id is required.",
      });
    if (!hasText(trap.pack))
      issues.push({
        path: `${path}.trapOptions[${index}].pack`,
        message: "Trap option pack is required.",
      });
  }
  for (const [index, guide] of buildGuides.entries()) {
    if (!hasText(guide.id))
      issues.push({
        path: `${path}.buildGuides[${index}].id`,
        message: "Build guide id is required.",
      });
    if (!hasText(guide.pack))
      issues.push({
        path: `${path}.buildGuides[${index}].pack`,
        message: "Build guide pack is required.",
      });
    if (!hasText(guide.description))
      issues.push({
        path: `${path}.buildGuides[${index}].description`,
        message: "Build guide description is required.",
      });
  }
  for (const [index, feat] of feats.entries()) {
    if (!hasText(feat.id))
      issues.push({
        path: `${path}.feats[${index}].id`,
        message: "Feat id is required.",
      });
    if (!hasText(feat.pack))
      issues.push({
        path: `${path}.feats[${index}].pack`,
        message: "Feat pack is required.",
      });
  }
  for (const [index, race] of races.entries()) {
    if (!hasText(race.id))
      issues.push({
        path: `${path}.races[${index}].id`,
        message: "Race id is required.",
      });
    if (!hasText(race.pack))
      issues.push({
        path: `${path}.races[${index}].pack`,
        message: "Race pack is required.",
      });
  }
  for (const [index, cls] of classes.entries()) {
    if (cls.hitDie <= 0)
      issues.push({
        path: `${path}.classes[${index}].hitDie`,
        message: "Hit die must be positive.",
      });
  }
  for (const [index, weapon] of weapons.entries()) {
    if (!hasText(weapon.id))
      issues.push({
        path: `${path}.weapons[${index}].id`,
        message: "Weapon id is required.",
      });
  }
  for (const [index, item] of magicItems.entries()) {
    if (!hasText(item.id))
      issues.push({
        path: `${path}.magicItems[${index}].id`,
        message: "Magic item id is required.",
      });
    if (!hasText(item.source))
      issues.push({
        path: `${path}.magicItems[${index}].source`,
        message: "Magic item source is required.",
      });
  }
  for (const [index, domain] of domains.entries()) {
    if (!hasText(domain.id))
      issues.push({
        path: `${path}.domains[${index}].id`,
        message: "Domain id is required.",
      });
  }
  for (const [index, school] of schools.entries()) {
    if (!hasText(school.id))
      issues.push({
        path: `${path}.schools[${index}].id`,
        message: "School id is required.",
      });
  }
  for (const [index, effect] of spellEffects.entries()) {
    if (!hasText(effect.id))
      issues.push({
        path: `${path}.spellEffects[${index}].id`,
        message: "Spell effect id is required.",
      });
    if (!hasText(effect.spellName))
      issues.push({
        path: `${path}.spellEffects[${index}].spellName`,
        message: "Spell effect spellName is required.",
      });
  }

  return issues;
}

export function validateRulesDataSet(data: RulesDataSet): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!hasText(data.schemaVersion))
    issues.push({
      path: "schemaVersion",
      message: "schemaVersion is required.",
    });
  if (!hasText(data.generatedAt))
    issues.push({ path: "generatedAt", message: "generatedAt is required." });

  pushDuplicateIssues(
    issues,
    "sources",
    data.sources.map((source) => source.id),
  );
  pushDuplicateIssues(
    issues,
    "packs",
    data.packs.map((pack) => pack.id),
  );

  for (const [index, source] of data.sources.entries()) {
    if (!hasText(source.id))
      issues.push({
        path: `sources[${index}].id`,
        message: "Source id is required.",
      });
    if (!hasText(source.name))
      issues.push({
        path: `sources[${index}].name`,
        message: "Source name is required.",
      });
  }
  for (const [index, pack] of data.packs.entries()) {
    issues.push(...validatePack(pack, `packs[${index}]`));
  }

  return issues;
}
