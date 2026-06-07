/** Format a value with an explicit sign, e.g. 3 -> "+3", -1 -> "-1". */
export function sign(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
