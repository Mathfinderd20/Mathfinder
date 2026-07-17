import { useMemo, useState } from "react";
import type { CharacterBuild } from "@mathfinder/rules-engine";

type EquipmentSlot = Exclude<
  NonNullable<CharacterBuild["equipment"]>[number]["slot"],
  undefined | "slotless"
>;
type SlotKey =
  | "head"
  | "eyes"
  | "neck"
  | "shoulders"
  | "chest"
  | "body"
  | "torso"
  | "wrists"
  | "hands"
  | "ring-left"
  | "ring-right"
  | "belt"
  | "feet"
  | "armor"
  | "shield";
type RegionKey =
  | "head"
  | "torso"
  | "left-arm"
  | "right-arm"
  | "hips"
  | "left-leg"
  | "right-leg"
  | "feet";

interface SlotDefinition {
  key: SlotKey;
  slot: EquipmentSlot | "ring";
  label?: string;
  className: string;
  bodyAnchor: [number, number];
  slotAnchor: [number, number];
  relatedRegions: RegionKey[];
}

const SLOT_DEFINITIONS: SlotDefinition[] = [
  {
    key: "head",
    slot: "head",
    className: "head",
    bodyAnchor: [380, 64],
    slotAnchor: [380, 62],
    relatedRegions: ["head"],
  },
  {
    key: "eyes",
    slot: "eyes",
    className: "eyes",
    bodyAnchor: [380, 95],
    slotAnchor: [380, 135],
    relatedRegions: ["head"],
  },
  {
    key: "neck",
    slot: "neck",
    className: "neck",
    bodyAnchor: [432, 122],
    slotAnchor: [544, 138],
    relatedRegions: ["head", "torso"],
  },
  {
    key: "shoulders",
    slot: "shoulders",
    className: "shoulders",
    bodyAnchor: [316, 148],
    slotAnchor: [176, 182],
    relatedRegions: ["left-arm", "right-arm", "torso"],
  },
  {
    key: "chest",
    slot: "chest",
    className: "chest",
    bodyAnchor: [444, 198],
    slotAnchor: [582, 218],
    relatedRegions: ["torso"],
  },
  {
    key: "body",
    slot: "body",
    className: "body",
    bodyAnchor: [320, 282],
    slotAnchor: [182, 300],
    relatedRegions: ["torso"],
  },
  {
    key: "torso",
    slot: "torso",
    className: "torso",
    bodyAnchor: [438, 332],
    slotAnchor: [576, 352],
    relatedRegions: ["torso", "hips"],
  },
  {
    key: "wrists",
    slot: "wrists",
    className: "wrists",
    bodyAnchor: [286, 350],
    slotAnchor: [172, 422],
    relatedRegions: ["left-arm"],
  },
  {
    key: "hands",
    slot: "hands",
    className: "hands",
    bodyAnchor: [478, 350],
    slotAnchor: [588, 422],
    relatedRegions: ["right-arm"],
  },
  {
    key: "ring-left",
    slot: "ring",
    className: "ring-left",
    label: "Ring L",
    bodyAnchor: [276, 408],
    slotAnchor: [170, 518],
    relatedRegions: ["left-arm"],
  },
  {
    key: "ring-right",
    slot: "ring",
    className: "ring-right",
    label: "Ring R",
    bodyAnchor: [484, 408],
    slotAnchor: [590, 518],
    relatedRegions: ["right-arm"],
  },
  {
    key: "belt",
    slot: "belt",
    className: "belt",
    bodyAnchor: [380, 414],
    slotAnchor: [380, 470],
    relatedRegions: ["hips"],
  },
  {
    key: "feet",
    slot: "feet",
    className: "feet",
    bodyAnchor: [380, 534],
    slotAnchor: [380, 602],
    relatedRegions: ["left-leg", "right-leg", "feet"],
  },
  {
    key: "armor",
    slot: "armor",
    className: "armor",
    bodyAnchor: [380, 214],
    slotAnchor: [380, 238],
    relatedRegions: ["torso"],
  },
  {
    key: "shield",
    slot: "shield",
    className: "shield",
    bodyAnchor: [490, 276],
    slotAnchor: [600, 286],
    relatedRegions: ["right-arm"],
  },
];

const REGION_TO_SLOTS: Record<RegionKey, SlotKey[]> = {
  head: ["head", "eyes", "neck"],
  torso: ["neck", "shoulders", "chest", "body", "torso", "armor"],
  "left-arm": ["shoulders", "wrists", "ring-left"],
  "right-arm": ["shoulders", "hands", "ring-right", "shield"],
  hips: ["torso", "belt"],
  "left-leg": ["belt", "feet"],
  "right-leg": ["belt", "feet"],
  feet: ["feet"],
};

function displayEquipmentSlot(slot: EquipmentSlot) {
  return slot.replace(/-/g, " ");
}

function connectorPath(from: [number, number], to: [number, number]) {
  const midX =
    from[0] < to[0]
      ? Math.max(from[0] + 28, (from[0] + to[0]) / 2)
      : Math.min(from[0] - 28, (from[0] + to[0]) / 2);
  return `M ${from[0]} ${from[1]} L ${midX} ${from[1]} L ${midX} ${to[1]} L ${to[0]} ${to[1]}`;
}

export function EquipmentSilhouette({
  equippedSlots,
}: {
  equippedSlots: Map<string, string[]>;
}) {
  const [hoveredSlotKey, setHoveredSlotKey] = useState<SlotKey | null>(null);
  const [hoveredRegionKey, setHoveredRegionKey] = useState<RegionKey | null>(
    null,
  );

  const activeSlotKeys = useMemo(() => {
    if (hoveredSlotKey) return new Set<SlotKey>([hoveredSlotKey]);
    if (hoveredRegionKey)
      return new Set<SlotKey>(REGION_TO_SLOTS[hoveredRegionKey]);
    return new Set<SlotKey>();
  }, [hoveredRegionKey, hoveredSlotKey]);

  const activeRegionKeys = useMemo(() => {
    if (hoveredRegionKey) return new Set<RegionKey>([hoveredRegionKey]);
    if (!hoveredSlotKey) return new Set<RegionKey>();
    const slot = SLOT_DEFINITIONS.find((entry) => entry.key === hoveredSlotKey);
    return new Set<RegionKey>(slot?.relatedRegions ?? []);
  }, [hoveredRegionKey, hoveredSlotKey]);

  const ringItems = equippedSlots.get("ring") ?? [];

  return (
    <div className="equipment-silhouette-panel">
      <div className="equipment-silhouette">
        <div className="equipment-silhouette-stage">
          <svg
            className="silhouette-connectors"
            viewBox="0 0 760 620"
            aria-hidden="true"
          >
            {SLOT_DEFINITIONS.map((definition) => {
              const items =
                definition.slot === "ring"
                  ? definition.key === "ring-left"
                    ? ringItems[0]
                      ? [ringItems[0]]
                      : []
                    : ringItems[1]
                      ? [ringItems[1]]
                      : []
                  : (equippedSlots.get(definition.slot) ?? []);
              const occupied = items.length > 0;
              const highlighted = activeSlotKeys.has(definition.key);
              return (
                <path
                  key={`connector-${definition.key}`}
                  className={`silhouette-connector${occupied ? " occupied" : ""}${highlighted ? " highlighted" : ""}`}
                  d={connectorPath(
                    definition.bodyAnchor,
                    definition.slotAnchor,
                  )}
                />
              );
            })}
          </svg>
          <div className="silhouette-body" aria-hidden="true">
            <div
              className={`silhouette-head${equippedSlots.get("head")?.length ? " occupied" : ""}${activeRegionKeys.has("head") ? " highlighted" : ""}`}
              onMouseEnter={() => setHoveredRegionKey("head")}
              onMouseLeave={() => setHoveredRegionKey(null)}
            ></div>
            <div
              className={`silhouette-torso${equippedSlots.get("armor")?.length || equippedSlots.get("chest")?.length || equippedSlots.get("body")?.length || equippedSlots.get("torso")?.length ? " occupied" : ""}${activeRegionKeys.has("torso") ? " highlighted" : ""}`}
              onMouseEnter={() => setHoveredRegionKey("torso")}
              onMouseLeave={() => setHoveredRegionKey(null)}
            ></div>
            <div
              className={`silhouette-arm left${equippedSlots.get("shoulders")?.length || equippedSlots.get("wrists")?.length ? " occupied" : ""}${activeRegionKeys.has("left-arm") ? " highlighted" : ""}`}
              onMouseEnter={() => setHoveredRegionKey("left-arm")}
              onMouseLeave={() => setHoveredRegionKey(null)}
            ></div>
            <div
              className={`silhouette-arm right${equippedSlots.get("shield")?.length || equippedSlots.get("hands")?.length ? " occupied" : ""}${activeRegionKeys.has("right-arm") ? " highlighted" : ""}`}
              onMouseEnter={() => setHoveredRegionKey("right-arm")}
              onMouseLeave={() => setHoveredRegionKey(null)}
            ></div>
            <div
              className={`silhouette-hips${equippedSlots.get("belt")?.length ? " occupied" : ""}${activeRegionKeys.has("hips") ? " highlighted" : ""}`}
              onMouseEnter={() => setHoveredRegionKey("hips")}
              onMouseLeave={() => setHoveredRegionKey(null)}
            ></div>
            <div
              className={`silhouette-leg left${equippedSlots.get("belt")?.length || equippedSlots.get("feet")?.length ? " occupied" : ""}${activeRegionKeys.has("left-leg") ? " highlighted" : ""}`}
              onMouseEnter={() => setHoveredRegionKey("left-leg")}
              onMouseLeave={() => setHoveredRegionKey(null)}
            ></div>
            <div
              className={`silhouette-leg right${equippedSlots.get("belt")?.length || equippedSlots.get("feet")?.length ? " occupied" : ""}${activeRegionKeys.has("right-leg") ? " highlighted" : ""}`}
              onMouseEnter={() => setHoveredRegionKey("right-leg")}
              onMouseLeave={() => setHoveredRegionKey(null)}
            ></div>
            <div
              className={`silhouette-foot left${equippedSlots.get("feet")?.length ? " occupied" : ""}${activeRegionKeys.has("feet") ? " highlighted" : ""}`}
              onMouseEnter={() => setHoveredRegionKey("feet")}
              onMouseLeave={() => setHoveredRegionKey(null)}
            ></div>
            <div
              className={`silhouette-foot right${equippedSlots.get("feet")?.length ? " occupied" : ""}${activeRegionKeys.has("feet") ? " highlighted" : ""}`}
              onMouseEnter={() => setHoveredRegionKey("feet")}
              onMouseLeave={() => setHoveredRegionKey(null)}
            ></div>
          </div>
          <div className="equipment-silhouette-slots">
            {SLOT_DEFINITIONS.map((definition) => {
              const items =
                definition.slot === "ring"
                  ? definition.key === "ring-left"
                    ? ringItems[0]
                      ? [ringItems[0]]
                      : []
                    : ringItems[1]
                      ? [ringItems[1]]
                      : []
                  : (equippedSlots.get(definition.slot) ?? []);
              const occupied = items.length > 0;
              const highlighted = activeSlotKeys.has(definition.key);
              return (
                <div
                  className={`silhouette-slot ${definition.className}${occupied ? " occupied" : ""}${highlighted ? " highlighted" : ""}`}
                  key={definition.key}
                  onMouseEnter={() => setHoveredSlotKey(definition.key)}
                  onMouseLeave={() => setHoveredSlotKey(null)}
                >
                  <div className="silhouette-slot-label">
                    {definition.label ??
                      displayEquipmentSlot(
                        definition.slot === "ring" ? "ring" : definition.slot,
                      )}
                  </div>
                  <div className="silhouette-slot-item">{items[0] ?? "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
