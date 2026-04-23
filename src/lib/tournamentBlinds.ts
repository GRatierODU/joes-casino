/** Small blind / big blind (chips), level index 0 = level 1 */
export const BLIND_LEVELS: [number, number][] = [
  [0.5, 1],
  [1, 1.5],
  [1, 2],
  [1.5, 3],
  [2, 4],
  [4, 8],
  [5, 10],
  [10, 20],
  [15, 30],
  [20, 40],
  [25, 50],
  [50, 100],
  [100, 200],
];

/** Seconds per blind level */
export const BLIND_DURATION = 20 * 60;

/** 1-based level after which “break & color up” is shown in schedule (after level 5, before level 6) */
export const BLIND_BREAK_BEFORE_LEVEL_INDEX = 5;

export function formatBlindChips(n: number): string {
  if (n === 0.5) return "$.5";
  if (Number.isInteger(n)) return `$${n}`;
  return `$${n}`;
}

export function formatBlindLevel(small: number, big: number): string {
  return `${formatBlindChips(small)} / ${formatBlindChips(big)}`;
}
