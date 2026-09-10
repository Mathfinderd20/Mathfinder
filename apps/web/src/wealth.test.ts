import { expect, it } from "vitest";
import { addCoinPurseValue, spendCoinPurse, coinPurseToCopper } from "./wealth";

it("adds and subtracts GP using exact copper and the fewest coins", () => {
  const purse = { gp: 10, sp: 12, cp: 42 };
  const added = addCoinPurseValue(purse, 123.45);
  expect(added).toEqual({ pp: 13, gp: 5, sp: 0, cp: 7 });
  const restored = spendCoinPurse(added, 123.45)!;
  expect(restored).toEqual({ pp: 1, gp: 1, sp: 6, cp: 2 });
  expect(coinPurseToCopper(restored)).toBe(coinPurseToCopper(purse));
  expect(spendCoinPurse(purse, 12)).toBeNull();
  expect(spendCoinPurse(purse, 11.62)).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
});
