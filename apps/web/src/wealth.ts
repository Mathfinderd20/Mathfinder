import type { CharacterBuild } from "@mathfinder/rules-engine";

export interface CoinPurse {
  pp?: number;
  gp?: number;
  sp?: number;
  cp?: number;
}

export interface WealthSummary {
  pp: number;
  gp: number;
  sp: number;
  cp: number;
  liquidWealthGp: number;
  coinWeightLb: number;
  gearCostGp: number;
  wishlistCostGp: number;
  totalWealthGp: number;
}

function wholeCount(value: number | undefined) {
  return Math.max(0, Math.floor(value ?? 0));
}

function ownedItem(item: NonNullable<CharacterBuild["equipment"]>[number]) {
  return (item.ownership ?? "owned") === "owned";
}

export function normalizeCoinPurse(coinPurse: CoinPurse | undefined): Required<CoinPurse> {
  return {
    pp: wholeCount(coinPurse?.pp),
    gp: wholeCount(coinPurse?.gp),
    sp: wholeCount(coinPurse?.sp),
    cp: wholeCount(coinPurse?.cp),
  };
}

export function coinPurseToCopper(coinPurse: CoinPurse | undefined) {
  const normalized = normalizeCoinPurse(coinPurse);
  return normalized.pp * 1000 + normalized.gp * 100 + normalized.sp * 10 + normalized.cp;
}

export function copperToCoinPurse(totalCopper: number): Required<CoinPurse> {
  let remaining = Math.max(0, Math.floor(totalCopper));
  const pp = Math.floor(remaining / 1000);
  remaining -= pp * 1000;
  const gp = Math.floor(remaining / 100);
  remaining -= gp * 100;
  const sp = Math.floor(remaining / 10);
  remaining -= sp * 10;
  return { pp, gp, sp, cp: remaining };
}

export function gpToCopper(valueGp: number) {
  return Math.max(0, Math.round(valueGp * 100));
}

export function spendCoinPurse(coinPurse: CoinPurse | undefined, valueGp: number) {
  const nextCopper = coinPurseToCopper(coinPurse) - gpToCopper(valueGp);
  if (nextCopper < 0) return null;
  return copperToCoinPurse(nextCopper);
}

export function addCoinPurseValue(coinPurse: CoinPurse | undefined, valueGp: number) {
  return copperToCoinPurse(coinPurseToCopper(coinPurse) + gpToCopper(valueGp));
}

export function summarizeWealth(build: CharacterBuild): WealthSummary {
  const { pp, gp, sp, cp } = normalizeCoinPurse(build.coinPurse);
  const liquidWealthGp = pp * 10 + gp + sp / 10 + cp / 100;
  const coinWeightLb = (pp + gp + sp + cp) / 50;
  const gearCostGp = (build.equipment ?? []).reduce(
    (sum, item) =>
      ownedItem(item) ? sum + (item.costGp ?? 0) * (item.quantity ?? 1) : sum,
    0,
  );
  const wishlistCostGp = (build.equipment ?? []).reduce(
    (sum, item) =>
      ownedItem(item) ? sum : sum + (item.costGp ?? 0) * (item.quantity ?? 1),
    0,
  );
  return {
    pp,
    gp,
    sp,
    cp,
    liquidWealthGp,
    coinWeightLb,
    gearCostGp,
    wishlistCostGp,
    totalWealthGp: liquidWealthGp + gearCostGp,
  };
}
