import type { Dispatch, SetStateAction } from "react";
import type { CharacterBuild } from "@mathfinder/rules-engine";
import { addCoinPurseValue, spendCoinPurse } from "../wealth";

type CoinDenomination = "pp" | "gp" | "sp" | "cp";

export function useInventoryCommerce(
  setBuild: Dispatch<SetStateAction<CharacterBuild>>,
) {
  function adjustCoinPurse(deltaGp: number) {
    if (!Number.isFinite(deltaGp) || deltaGp === 0) return;
    setBuild((previous) => {
      const coinPurse =
        deltaGp < 0
          ? spendCoinPurse(previous.coinPurse, -deltaGp)
          : addCoinPurseValue(previous.coinPurse, deltaGp);
      return coinPurse ? { ...previous, coinPurse } : previous;
    });
  }

  function updateCoinPurse(denomination: CoinDenomination, value: number) {
    setBuild((previous) => ({
      ...previous,
      coinPurse: {
        ...(previous.coinPurse ?? {}),
        [denomination]: Math.max(0, Math.floor(value)),
      },
    }));
  }

  function updateCoinWeightCountsTowardEncumbrance(enabled: boolean) {
    setBuild((previous) => ({
      ...previous,
      coinWeightCountsTowardEncumbrance: enabled,
    }));
  }

  function buyEquipment(index: number, quantity = 1) {
    setBuild((previous) => {
      const item = previous.equipment?.[index];
      if (!item) return previous;
      const count = Math.max(
        1,
        Math.min(item.quantity ?? 1, Math.floor(quantity)),
      );
      const nextCoinPurse = spendCoinPurse(
        previous.coinPurse,
        (item.costGp ?? 0) * count,
      );
      if (!nextCoinPurse) return previous;
      const equipment = [...(previous.equipment ?? [])];
      const entry = equipment[index];
      if (!entry) return previous;
      if ((entry.ownership ?? "owned") === "wishlist") {
        const remaining = Math.max(0, (entry.quantity ?? 1) - count);
        const ownedCopy = {
          ...entry,
          ownership: "owned" as const,
          quantity: count,
          equipped: true,
          carryState: "stowed" as const,
        };
        if (remaining > 0) equipment[index] = { ...entry, quantity: remaining };
        else equipment.splice(index, 1);
        equipment.unshift(ownedCopy);
      } else {
        equipment[index] = {
          ...entry,
          quantity: (entry.quantity ?? 1) + count,
        };
      }
      return { ...previous, coinPurse: nextCoinPurse, equipment };
    });
  }

  function sellEquipment(index: number, quantity = 1) {
    setBuild((previous) => {
      const item = previous.equipment?.[index];
      if (!item || (item.ownership ?? "owned") !== "owned") return previous;
      const count = Math.max(
        1,
        Math.min(item.quantity ?? 1, Math.floor(quantity)),
      );
      const equipment = [...(previous.equipment ?? [])];
      const remaining = Math.max(0, (item.quantity ?? 1) - count);
      if (remaining > 0) equipment[index] = { ...item, quantity: remaining };
      else equipment.splice(index, 1);
      return {
        ...previous,
        coinPurse: addCoinPurseValue(
          previous.coinPurse,
          ((item.costGp ?? 0) * count) / 2,
        ),
        equipment,
      };
    });
  }

  return {
    buyEquipment,
    sellEquipment,
    adjustCoinPurse,
    updateCoinPurse,
    updateCoinWeightCountsTowardEncumbrance,
  };
}
