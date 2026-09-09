import type { RuntimeAction } from "@mathfinder/rules-engine";

export const FATIGUED_EFFECT_ID = "condition:fatigued";
export const retainedEffectKey = (id: string) => `ui:retained-effect:${id}`;

/** Shelf membership uses namespaced UI flags, not math modifiers or new database columns. */
export function selectEffectActions(
  ids: string[],
  active: boolean,
  retain = true,
): RuntimeAction[] {
  return [...new Set(ids)].flatMap((id) => [
    { type: "set-flag" as const, key: retainedEffectKey(id), value: retain },
    id === FATIGUED_EFFECT_ID
      ? { type: "set-flag" as const, key: "fatigued", value: active }
      : { type: "set-toggle" as const, id, value: active },
  ]);
}
