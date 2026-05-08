export const BAD_BEAT_RANKS = [
  "A",
  "K",
  "Q",
  "J",
  "T",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
] as const;

export const BAD_BEAT_SUITS = ["s", "h", "d", "c"] as const;

const RANK_SET = new Set<string>(BAD_BEAT_RANKS);
const SUIT_SET = new Set<string>(BAD_BEAT_SUITS);

/** All 52 codes, e.g. `Ah`, `Ts` */
export function allBadBeatCardCodes(): string[] {
  const out: string[] = [];
  for (const s of BAD_BEAT_SUITS) {
    for (const r of BAD_BEAT_RANKS) {
      out.push(`${r}${s}`);
    }
  }
  return out;
}

/** Normalize to `Rank` + `suit` (e.g. `Ah`) or null if invalid. */
export function parseBadBeatCard(code: string): string | null {
  const t = code.trim();
  const m = t.match(/^([2-9TJQKA])([shdc])$/i);
  if (!m) return null;
  const rank = m[1].toUpperCase();
  const suit = m[2].toLowerCase();
  if (!RANK_SET.has(rank) || !SUIT_SET.has(suit)) return null;
  return `${rank}${suit}`;
}

export function suitDisplay(suit: string): { symbol: string; red: boolean } {
  switch (suit) {
    case "h":
      return { symbol: "\u2665", red: true };
    case "d":
      return { symbol: "\u2666", red: true };
    case "c":
      return { symbol: "\u2663", red: false };
    default:
      return { symbol: "\u2660", red: false };
  }
}

export function rankDisplay(rank: string): string {
  return rank === "T" ? "10" : rank;
}

export type BadBeatSeatRow = {
  seat: number;
  name: string;
  hole: [string, string];
};

export type BadBeatTableV2 = {
  id: string;
  createdAt: string;
  /** Calendar date YYYY-MM-DD when the hand happened (optional on older entries). */
  beatDate?: string;
  v: 2;
  seats: BadBeatSeatRow[];
  board: [string, string, string, string, string];
};

export type BadBeatLegacy = {
  id: string;
  createdAt: string;
  players: string;
  hands: string;
  flop: string;
};

export type BadBeatEntry = BadBeatTableV2 | BadBeatLegacy;

export function isBadBeatLegacy(e: BadBeatEntry): e is BadBeatLegacy {
  return (e as BadBeatTableV2).v !== 2;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseBeatDateInput(s: string): string | null {
  const t = s.trim();
  if (!ISO_DATE_RE.test(t)) return null;
  const d = new Date(t + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return t;
}

/** One-line label for hall-of-fame card header. */
export function formatBadBeatEntryWhen(e: BadBeatEntry): string {
  if (!isBadBeatLegacy(e) && e.beatDate && ISO_DATE_RE.test(e.beatDate)) {
    return new Date(e.beatDate + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  try {
    return new Date(e.createdAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return e.createdAt;
  }
}

export function seatsArrayFromRows(
  rows: BadBeatSeatRow[]
): (null | { name: string; hole: [string, string] })[] {
  const a: (null | { name: string; hole: [string, string] })[] =
    Array.from({ length: 10 }, () => null);
  for (const r of rows) {
    if (r.seat >= 0 && r.seat < 10 && r.name.trim()) {
      a[r.seat] = { name: r.name.trim(), hole: r.hole };
    }
  }
  return a;
}

export function collectUsedCards(
  seats: (null | { hole: [string, string] })[],
  board: string[]
): Set<string> {
  const used = new Set<string>();
  for (const s of seats) {
    if (!s) continue;
    for (const c of s.hole) {
      const p = parseBadBeatCard(c);
      if (p) used.add(p);
    }
  }
  for (const c of board) {
    const p = parseBadBeatCard(c);
    if (p) used.add(p);
  }
  return used;
}
