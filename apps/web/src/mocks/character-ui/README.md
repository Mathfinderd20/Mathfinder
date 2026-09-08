# Unified Character Workspace mock

This interactive mock is intentionally isolated from the production character and campaign workspaces. Open `/character-ui-mock.html` in the Vite application.

A committed, self-contained HTML review export lives at `design-mocks/character-ui/character-ui-mock.html`. Its UI, styles, scripts, and portrait are embedded in that single file. Regenerate it from the repository root with `npm run build:character-mock`; do not hand-edit the compiled file.

## Scenarios

- **Player** opens Seren Ashfall on the default Character tab.
- **Multiclass caster** opens Elowen Vey on Magic and demonstrates independent Cleric, Wizard, and granted/SLA sources.
- **GM monster** opens a campaign-scoped vampire owlbear build composed from a codex base, added racial Hit Dice, a template, and class levels.

The scenario switcher is mock navigation, not a proposed production control.

## Approved product decisions represented here

- Tabs are `Notes`, `Character`, `Inventory`, `Magic`, and `Build`; Character is the default.
- The same workspace shell applies to players, user-built characters, NPCs, monsters, villains, allies, and summons.
- Player notes are visible only to the player. GM character notes are visible only to the GM and exist only in that campaign.
- Notes reuse the campaign notebook experience: multiple notes, search, categories, pinning, lightweight formatting, and autosave status. The selector is on the left in both character Notes and GM Campaign Notes.
- The Character page follows the official PF1e spatial hierarchy: abilities, defenses, combat, and weapons on the left; a dense skills table on the right.
- The Character tab alone owns the `Abilities & Effects` rail, with fixed search plus independently collapsible `Active Now`, `My Abilities`, and `Effects & Conditions` groups. Empty groups collapse by default. Notes and Build are full-width; Inventory and Magic retain their task-specific search rails.
- Calculated math is available through click/focus as well as hover. GM users can add or remove any campaign-scoped modifying value at any time.
- A condition that grants subsequent saves exposes `Attempt save`. The affected character's player or the GM resolves the save; success removes the condition. The GM and the effect's player source may remove it directly.
- Spellcasting never assumes a digital battle map. Casting selects affected tabletop characters, spends the chosen source's resource only on confirmation, and sends save/effect resolution to the affected sheets.
- Multiple casting sources keep independent headers, caster levels, spell lists, DCs, and resource pools. Search may span all sources, but every Cast action identifies the source being spent.
- Spell rows carry a short effect summary, save/DC, and verbal, somatic, and material/focus components. Prepared casters choose quantities from the source Library, capped by that spell level's open slots.
- Selecting a spell opens its complete rules dialog: school, casting time, components, range, target/area, duration, saving throw/DC, spell resistance, preparation state, and full description. Cast or Prepare remains available from that dialog.
- Domain spells remain inside their granting class source and the unified Spells list, but use a distinct Domain marker and the dedicated domain-slot allowance for their level.
- Prepared spell rows expose `Reprepare`. The guided dialog releases that exact normal or domain slot, filters the character's known/eligible spells to matching level and slot type, and atomically replaces the preparation on confirmation.
- The Character tab exposes `Rest` beside health management. It previews the active campaign's rest period and HP rule, then restores eligible HP, expended spell slots, and per-day resources. Existing spell preparations remain assigned; conditions clear only when their duration or a campaign rule says so.
- Inventory promotes the equipment figure, separates Carried from Stored, gives carried weapons their own table, and keeps ammunition adjacent to its weapon.
- Monster and NPC Build use the same collapsible Level Progression chart as player characters. Racial Hit Dice and class levels occupy explicit lines; templates and codex origin remain attached modifiers outside the level sequence.
- Build progression reads top to bottom and can collapse. Every character-level line records the class taken and its resulting class level; its full choice breakdown expands directly beneath that line instead of appearing in a detached panel.
- `Level Up` lives in the Build header and opens the retained guided advancement flow. Class, feat, skill, and spell discovery appears inside that flow or an on-demand Build Library, not a permanent rail.
- Build includes editable Race and Campaign Traits records. Race shows the selected race and its standard, choice-based, and alternate racial traits. Campaign Traits are optional, campaign-governed selections with a typical allowance of one to three.
- Race and Campaign Traits remain data-aware sections for codex NPCs when their source records provide those fields, but ordinary monster records omit the sections.
- Every progression line has an `Edit` action that reopens the guided level workflow in respec mode. A player may replace the class at that level or make a narrow feat, skill, spell, HP, or feature change; dependent later choices are revalidated before saving.
- The Character Creation Guide includes a required Race step and an optional Campaign Traits step. Both choices can be modified later with an impact review and validation against current campaign rules.
- GM workflow is desktop-only. Player views include responsive behavior and turn the right rail into an overlay on narrow screens.

## Existing behavior that implementation must preserve

### Character and runtime

- Ability, AC, save, initiative, CMB/CMD, attack, damage, HP, speed, skill, encumbrance, and spell math breakdowns.
- Manual d20 entry and totals for saves, skills, initiative, CMB, and attacks.
- Damage, healing, direct HP loss, temporary HP, nonlethal damage/recovery, stability, revival, Diehard/ferocity behavior, and death thresholds.
- Activatable abilities, exclusive toggle groups, buffs, conditions, auras, runtime resources, conflicts, blocked reasons, and fatigue.
- Weapon attacks, ammunition consumption/loading/reset, attack history, undo, hit/miss/critical outcomes, result notes, and combat event log.
- Feats, archetypes, racial traits, class features, suppressed features, senses, movement modes, resistances, damage reduction, languages, and validation.

### Inventory

- Coin purse, coin weight, carried-weight override, ownership/wishlist, buy/sell, carry state, containers, component categories, uses, consumables, ammunition, and inventory totals.
- Search, filtering, sorting, grouping, equipment slots, slot-conflict warnings, equipment silhouette, quick add, and reset filters.
- Custom and templated weapons, armor, shields, mundane equipment, and magic items, including detailed properties, upgrade tiers, automation/source metadata, spell triggers, and firearm/ordnance fields.

### Magic

- Prepared and spontaneous casters, spell library, known/prepared selections, granted spells, domains, specialist schools, suggestions, spell metadata, extra/restricted slots, slot use/reset, runtime casting, and diagnostics.
- Preparation must prevent a caster from assigning more copies than the remaining normal or domain slots at that spell level. Domain spells cannot consume ordinary prepared slots unless another rule separately grants that permission.
- Repreparing must preserve slot accounting: the existing preparation is not removed until a valid replacement is confirmed, and the replacement must be eligible for the released source, spell level, and domain/normal slot type.

### Build

- Name, alignment, base ability scores, ancestry and ancestry choices, alternate traits, favored class, campaign rules, archetypes, class levels, HP, feats, ability increases, skill ranks, guided suggestions, level planning through 20, validation, and level-up/rollback flows.
- Character creation and later editing must include Race, racial trait replacements/choices, and optional Campaign Traits constrained by the selected campaign's trait catalog and one-to-three-trait allowance.
- Respec must preserve character identity, inventory, notes, presentation metadata, and campaign relationships while recalculating the edited level and validating all dependent later levels. Present conflicts for review rather than silently discarding choices.
- Spell construction controls move to Magic but retain the same data and behavior.

### GM campaign copy

- Add/remove from tabletop and roster, initiative and grouping, turn state, dual initiative, surprise-round awareness, HP/maximum HP, conditions, GM-private notes, campaign autosave, and source character isolation.

## Implementation boundary and schema callout

The current `CharacterBuild` rules schema does not include portraits, player notes, deity, gender, age, height, weight, homeland, associations, or similar flavor fields. Store these in character presentation metadata keyed by character ID so the calculation schema remains unchanged. This is an intentional sidecar boundary that may later be migrated into a first-class character profile schema.

Effect targeting and subsequent-save flows will likely require runtime/campaign metadata for effect source, owner authority, affected character IDs, save type, DC, repeat-save timing, duration, and removal state. Preserve the existing campaign workspace JSON document rather than replacing the recently implemented campaign persistence model.

Manual GM modifiers should be campaign-scoped layers over derived values, not destructive edits to an imported player's build. The UI must nevertheless give the GM full authority to add or remove any modifying value on the campaign copy.

Rest resolution must read the character's active campaign rules rather than hard-code natural healing. Apply HP recovery, spell-slot restoration, per-day resource reset, rest interruption, and condition-duration behavior as one auditable runtime event. For prepared casters, restoring a spent slot does not silently change the spell already assigned to it.

## Image asset

`public/mock-assets/seren-ashfall.png` was generated for this mock with the built-in image generation tool. Prompt: an original square painterly fantasy portrait of Seren Ashfall, a practical half-elf ranger in a rain-dark forest with restrained charcoal, moss, teal, parchment, and amber tones; no text, logos, watermark, or ornate armor.
