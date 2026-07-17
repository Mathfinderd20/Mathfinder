import {
  CORE_MAGIC_ITEMS,
  type MagicItemDefinition,
} from "@mathfinder/rules-engine";

export const CORE_RULES_MAGIC_ITEMS: MagicItemDefinition[] =
  CORE_MAGIC_ITEMS.map((item) => ({
    ...item,
    modifiers: item.modifiers.map((modifier) => ({
      ...modifier,
      pack: modifier.pack ?? "core",
    })),
  }));
