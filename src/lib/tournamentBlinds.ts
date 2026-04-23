/** Stored on new tournaments; older active tournaments omit this and use legacy schedule. */
export const TOURNAMENT_SCHEDULE_VERSION = 2;

/** Older in-flight tournaments (no `scheduleVersion` on state) use this ladder and 15-minute levels. */
export const LEGACY_BLIND_LEVELS: [number, number][] = [
  [1, 2],
  [2, 4],
  [3, 6],
  [5, 10],
  [10, 20],
  [15, 30],
  [20, 40],
  [25, 50],
  [50, 100],
  [75, 150],
  [100, 200],
  [150, 300],
  [200, 400],
];

export const LEGACY_BLIND_DURATION = 15 * 60;

/** Small blind / big blind (chips), level index 0 = level 1 — new tournaments only */
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
  if (n === 0.5) return "$0.5";
  if (Number.isInteger(n)) return `$${n}`;
  return `$${n}`;
}

export function formatBlindLevel(small: number, big: number): string {
  return `${formatBlindChips(small)} / ${formatBlindChips(big)}`;
}

export type TournamentScheduleState = { scheduleVersion?: number } | null | undefined;

export function resolveTournamentSchedule(state: TournamentScheduleState): {
  levels: [number, number][];
  duration: number;
} {
  const v = state?.scheduleVersion ?? 1;
  if (v >= TOURNAMENT_SCHEDULE_VERSION) {
    return { levels: BLIND_LEVELS, duration: BLIND_DURATION };
  }
  return { levels: LEGACY_BLIND_LEVELS, duration: LEGACY_BLIND_DURATION };
}
