import {
  SAMPLE_CLASSES,
  SKILL_DEFINITIONS,
  type AbilityKey,
  type CharacterBuild,
  type DerivedSpellcasting,
  type SkillKey,
} from "@path-builder/rules-engine";
import type { ReactNode } from "react";
import { SpellcastingManager } from "./SpellcastingManager";

type SpellCastCounts = Record<string, Record<number, Record<string, number>>>;

type SpellMode = "prepared" | "known";

interface EquipmentArmorEditorState {
  category: "none" | "light" | "medium" | "heavy";
  maxDexBonus?: number;
  checkPenalty?: number;
  speedPenalty?: number;
}

interface Props {
  build: CharacterBuild;
  sheetSpellcasting: DerivedSpellcasting[];
  abilityOrder: readonly AbilityKey[];
  raceOptions: [string, CharacterBuild["race"]][];
  classOptions: Array<{ name: string; hitDie: number }>;
  featOptions: string[];
  skillName: Map<string, string>;
  spellOptions: Array<{ id: string; name: string }>;
  spellCastCounts: SpellCastCounts;
  onUpdateName: (name: string) => void;
  onUpdateBaseAbilityScore: (ability: AbilityKey, value: number) => void;
  onUpdateCarriedWeight: (raw: string) => void;
  onUpdateRace: (raceKey: string) => void;
  onAddStructureLevel: () => void;
  onRemoveStructureLevel: (levelIndex: number) => void;
  onUpdateLevelField: <K extends keyof CharacterBuild["levels"][number]>(
    levelIndex: number,
    key: K,
    value: CharacterBuild["levels"][number][K],
  ) => void;
  onAddLevelFeat: (levelIndex: number) => void;
  onRemoveLevelFeat: (levelIndex: number, featIndex: number) => void;
  onUpdateLevelFeatName: (levelIndex: number, featIndex: number, value: string) => void;
  onUpdateLevelSkillRank: (levelIndex: number, skillKey: SkillKey, value: number) => void;
  onAddSelection: (classKey: string, mode: SpellMode, level: number) => void;
  onAppendSelection: (classKey: string, mode: SpellMode, level: number, spellName: string) => void;
  onUpdateSelectionName: (classKey: string, mode: SpellMode, level: number, index: number, value: string) => void;
  onRemoveSelection: (classKey: string, mode: SpellMode, level: number, index: number) => void;
  onResetSelectionsForLevel: (classKey: string, mode: SpellMode, level: number) => void;
  onResetSelectionsForClass: (classKey: string, mode: SpellMode, levels: number[]) => void;
  onAddLibraryEntry: (classKey: string, level: number) => void;
  onAppendLibraryEntry: (classKey: string, level: number, spellName: string) => void;
  onUpdateLibraryName: (classKey: string, level: number, index: number, value: string) => void;
  onRemoveLibraryEntry: (classKey: string, level: number, index: number) => void;
  onResetLibraryLevel: (classKey: string, level: number) => void;
  onResetLibraryForClass: (classKey: string, levels: number[]) => void;
  onFillSelectionsFromLibrary: (classKey: string, mode: SpellMode, level: number, capacity: number) => void;
  onAdjustSpellSlot: (classKey: string, level: number, max: number, delta: number) => void;
  onCastSpell: (classKey: string, level: number, max: number, spellName: string, remaining: number) => void;
  onResetSpellSlotLevel: (classKey: string, level: number) => void;
  onResetSpellRuntimeClass: (classKey: string, levels: number[]) => void;
  onAddWeapon: () => void;
  onUpdateWeapon: (index: number, patch: Partial<NonNullable<CharacterBuild["weapons"]>[number]>) => void;
  onRemoveWeapon: (index: number) => void;
  onAddEquipment: () => void;
  onUpdateEquipment: (index: number, patch: Partial<NonNullable<CharacterBuild["equipment"]>[number]>) => void;
  onUpdateEquipmentArmor: (index: number, patch: EquipmentArmorEditorState) => void;
  onRemoveEquipment: (index: number) => void;
}

export function BuildEditorTab(props: Props) {
  const {
    build,
    sheetSpellcasting,
    abilityOrder,
    raceOptions,
    classOptions,
    featOptions,
    skillName,
    spellOptions,
    spellCastCounts,
  } = props;

  return (
    <div className="build-page">
      <section className="panel build-panel">
        <h2>Build Editor</h2>
        <p className="hint">This is the crunchy tab. Poke the build here; admire the pretty sheet on the other tab.</p>
        <label className="field compact">
          <span>Name</span>
          <input type="text" value={build.name} onChange={(e) => props.onUpdateName(e.target.value || "Unnamed Hero")} />
        </label>
        <div className="editor-grid">
          {abilityOrder.map((ability) => (
            <label className="field compact" key={ability}>
              <span>{ability.toUpperCase()}</span>
              <input
                type="number"
                min={1}
                value={build.baseAbilityScores[ability]}
                onChange={(e) => props.onUpdateBaseAbilityScore(ability, Number(e.target.value) || 1)}
              />
            </label>
          ))}
        </div>
        <label className="field compact">
          <span>Manual carried weight (lb) <span className="muted">optional override</span></span>
          <input type="number" min={0} value={build.carriedWeight ?? ""} onChange={(e) => props.onUpdateCarriedWeight(e.target.value)} />
        </label>

        <div className="editor-section-head">
          <h3>Race & Level Structure</h3>
          <button className="ghost small" onClick={props.onAddStructureLevel}>Add Level</button>
        </div>
        <label className="field compact">
          <span>Race</span>
          <select value={raceOptions.find(([, race]) => race.name === build.race.name)?.[0] ?? "human"} onChange={(e) => props.onUpdateRace(e.target.value)}>
            {raceOptions.map(([key, race]) => <option key={key} value={key}>{race.name}</option>)}
          </select>
        </label>

        <div className="editor-section-head">
          <h3>Feats, Skills & Structure by Level</h3>
        </div>
        <datalist id="feat-options">
          {featOptions.map((name) => <option key={name} value={name} />)}
        </datalist>
        <div className="item-list">
          {build.levels.map((level, levelIndex) => (
            <div className="item-card" key={`level-edit-${levelIndex}`}>
              <div className="editor-section-head tight">
                <h3>Level {levelIndex + 1} — {level.className}</h3>
                <button className="ghost small" disabled={build.levels.length <= 1} onClick={() => props.onRemoveStructureLevel(levelIndex)}>Remove Level</button>
              </div>
              <div className="editor-grid">
                <label className="field compact">
                  <span>Class</span>
                  <select value={level.className} onChange={(e) => props.onUpdateLevelField(levelIndex, "className", e.target.value)}>
                    {classOptions.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
                  </select>
                </label>
                <label className="field compact">
                  <span>HP roll</span>
                  <input type="number" min={1} max={classOptions.find((option) => option.name === level.className)?.hitDie ?? 20} value={level.hitPointRoll} onChange={(e) => props.onUpdateLevelField(levelIndex, "hitPointRoll", Math.max(1, Number(e.target.value) || 1))} />
                </label>
                <label className="field compact">
                  <span>Favored class</span>
                  <select value={level.favoredClass ?? ""} onChange={(e) => props.onUpdateLevelField(levelIndex, "favoredClass", (e.target.value || undefined) as "hp" | "skill" | undefined)}>
                    <option value="">None</option>
                    <option value="hp">HP</option>
                    <option value="skill">Skill</option>
                  </select>
                </label>
                <label className="field compact">
                  <span>Ability increase</span>
                  <select value={level.abilityIncrease ?? ""} onChange={(e) => props.onUpdateLevelField(levelIndex, "abilityIncrease", (e.target.value || undefined) as AbilityKey | undefined)}>
                    <option value="">None</option>
                    {abilityOrder.map((ability) => <option key={ability} value={ability}>{ability.toUpperCase()}</option>)}
                  </select>
                </label>
              </div>
              <div className="subsection-title">Feats</div>
              <div className="item-list compact-list">
                {(level.feats ?? []).map((featName, featIndex) => (
                  <div className="inline-row" key={`feat-${levelIndex}-${featIndex}`}>
                    <input className="inline-input" type="text" list="feat-options" value={featName} onChange={(e) => props.onUpdateLevelFeatName(levelIndex, featIndex, e.target.value)} />
                    <button className="ghost small" onClick={() => props.onRemoveLevelFeat(levelIndex, featIndex)}>Remove</button>
                  </div>
                ))}
                <div className="item-actions left">
                  <button className="ghost small" onClick={() => props.onAddLevelFeat(levelIndex)}>Add Feat</button>
                </div>
              </div>
              <div className="subsection-title">Skill Ranks</div>
              <div className="skill-rank-grid">
                {SKILL_DEFINITIONS.slice().sort((a, b) => a.name.localeCompare(b.name)).map((skill) => (
                  <label className="field compact skill-rank-field" key={`rank-${levelIndex}-${skill.key}`}>
                    <span>{skillName.get(skill.key) ?? skill.key}</span>
                    <input type="number" min={0} step={1} value={level.skillRanks?.[skill.key] ?? 0} onChange={(e) => props.onUpdateLevelSkillRank(levelIndex, skill.key, Math.max(0, Number(e.target.value) || 0))} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <SpellcastingManager
          casters={sheetSpellcasting}
          spellOptions={spellOptions}
          spellCastCounts={spellCastCounts}
          onAddSelection={props.onAddSelection}
          onAppendSelection={props.onAppendSelection}
          onUpdateSelectionName={props.onUpdateSelectionName}
          onRemoveSelection={props.onRemoveSelection}
          onResetSelectionsForLevel={props.onResetSelectionsForLevel}
          onResetSelectionsForClass={props.onResetSelectionsForClass}
          onAddLibraryEntry={props.onAddLibraryEntry}
          onAppendLibraryEntry={props.onAppendLibraryEntry}
          onUpdateLibraryName={props.onUpdateLibraryName}
          onRemoveLibraryEntry={props.onRemoveLibraryEntry}
          onResetLibraryLevel={props.onResetLibraryLevel}
          onResetLibraryForClass={props.onResetLibraryForClass}
          onFillSelectionsFromLibrary={props.onFillSelectionsFromLibrary}
          onAdjustSpellSlot={props.onAdjustSpellSlot}
          onCastSpell={props.onCastSpell}
          onResetSpellSlotLevel={props.onResetSpellSlotLevel}
          onResetSpellRuntimeClass={props.onResetSpellRuntimeClass}
        />

        <EditorSection title="Weapons" action={<button className="ghost small" onClick={props.onAddWeapon}>Add Weapon</button>}>
          {(build.weapons ?? []).map((weapon, index) => (
            <div className="item-card" key={`weapon-${index}`}>
              <div className="editor-grid">
                <label className="field compact"><span>Name</span><input type="text" value={weapon.name} onChange={(e) => props.onUpdateWeapon(index, { name: e.target.value })} /></label>
                <label className="field compact"><span>Category</span><select value={weapon.category} onChange={(e) => props.onUpdateWeapon(index, { category: e.target.value as "melee" | "ranged" })}><option value="melee">Melee</option><option value="ranged">Ranged</option></select></label>
                <label className="field compact"><span>Damage dice</span><input type="text" value={weapon.damageDice} onChange={(e) => props.onUpdateWeapon(index, { damageDice: e.target.value || "1d6" })} /></label>
                <label className="field compact"><span>Handedness</span><select value={weapon.handedness ?? "one"} onChange={(e) => props.onUpdateWeapon(index, { handedness: e.target.value as "one" | "two" | "off" | "light" })}><option value="one">One-Handed</option><option value="two">Two-Handed</option><option value="off">Off-Hand</option><option value="light">Light</option></select></label>
                <label className="field compact"><span>Crit range</span><input type="number" min={18} max={20} value={weapon.critRange ?? 20} onChange={(e) => props.onUpdateWeapon(index, { critRange: Math.max(18, Math.min(20, Number(e.target.value) || 20)) })} /></label>
                <label className="field compact"><span>Crit multiplier</span><input type="number" min={2} max={5} value={weapon.critMultiplier ?? 2} onChange={(e) => props.onUpdateWeapon(index, { critMultiplier: Math.max(2, Math.min(5, Number(e.target.value) || 2)) })} /></label>
              </div>
              <div className="item-actions"><button className="ghost small" onClick={() => props.onRemoveWeapon(index)}>Remove</button></div>
            </div>
          ))}
        </EditorSection>

        <EditorSection title="Equipment" action={<button className="ghost small" onClick={props.onAddEquipment}>Add Item</button>}>
          {(build.equipment ?? []).map((item, index) => {
            const armor: EquipmentArmorEditorState = item.armor
              ? { category: item.armor.category ?? "light", maxDexBonus: item.armor.maxDexBonus, checkPenalty: item.armor.checkPenalty, speedPenalty: item.armor.speedPenalty }
              : { category: "none", maxDexBonus: undefined, checkPenalty: undefined, speedPenalty: undefined };
            return (
              <div className="item-card" key={`equipment-${index}`}>
                <div className="editor-grid">
                  <label className="field compact"><span>Name</span><input type="text" value={item.name} onChange={(e) => props.onUpdateEquipment(index, { name: e.target.value })} /></label>
                  <label className="field compact"><span>Quantity</span><input type="number" min={0} value={item.quantity ?? 1} onChange={(e) => props.onUpdateEquipment(index, { quantity: Math.max(0, Number(e.target.value) || 0) })} /></label>
                  <label className="field compact"><span>Weight (lb)</span><input type="number" min={0} value={item.weight ?? 0} onChange={(e) => props.onUpdateEquipment(index, { weight: Math.max(0, Number(e.target.value) || 0) })} /></label>
                  <label className="field compact"><span>Cost (gp)</span><input type="number" min={0} value={item.costGp ?? 0} onChange={(e) => props.onUpdateEquipment(index, { costGp: Math.max(0, Number(e.target.value) || 0) })} /></label>
                  <label className="field compact"><span>Armor category</span><select value={armor.category} onChange={(e) => props.onUpdateEquipmentArmor(index, { ...armor, category: e.target.value as EquipmentArmorEditorState["category"] })}><option value="none">None</option><option value="light">Light</option><option value="medium">Medium</option><option value="heavy">Heavy</option></select></label>
                  <label className="field compact checkbox-field"><span>Equipped</span><input type="checkbox" checked={!!item.equipped} onChange={(e) => props.onUpdateEquipment(index, { equipped: e.target.checked })} /></label>
                  <label className="field compact"><span>Max Dex</span><input type="number" value={armor.maxDexBonus ?? ""} onChange={(e) => props.onUpdateEquipmentArmor(index, { ...armor, maxDexBonus: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
                  <label className="field compact"><span>Armor check penalty</span><input type="number" value={armor.checkPenalty ?? ""} onChange={(e) => props.onUpdateEquipmentArmor(index, { ...armor, checkPenalty: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
                  <label className="field compact"><span>Speed penalty</span><input type="number" min={0} value={armor.speedPenalty ?? ""} onChange={(e) => props.onUpdateEquipmentArmor(index, { ...armor, speedPenalty: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0) })} /></label>
                </div>
                <div className="item-actions"><button className="ghost small" onClick={() => props.onRemoveEquipment(index)}>Remove</button></div>
              </div>
            );
          })}
        </EditorSection>
      </section>
    </div>
  );
}

function EditorSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="editor-section-head">
        <h3>{title}</h3>
        {action}
      </div>
      <div className="item-list">{children}</div>
    </>
  );
}
