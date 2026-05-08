/** Stored in Redis under `joes-players` */
export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  picture?: string;
};

/** API GET includes computed display name */
export type PublicPlayer = Player & { displayName: string };

/** Public table seat (new format) */
export type SeatV2 = {
  playerId: string;
  buyin: number;
  /** Casino calendar date (YYYY-MM-DD) when they sat; used to bucket session history on cash-out. */
  sessionDay?: string;
};

/** Legacy seat from before player accounts */
export type SeatLegacy = {
  name: string;
  buyin: number;
  sessionDay?: string;
};

export type TableSeat = SeatV2 | SeatLegacy | null;

/** First name + last initial (ignores nickname). */
export function playerFormalShortName(p: Pick<Player, "firstName" | "lastName">): string {
  const first = p.firstName.trim();
  const last = p.lastName.trim();
  if (!last) return first || "Player";
  const initial = last.charAt(0).toUpperCase() + ".";
  return `${first} ${initial}`;
}

export function playerDisplayName(p: Pick<Player, "firstName" | "lastName" | "nickname">): string {
  const nick = p.nickname?.trim();
  if (nick) return nick;
  return playerFormalShortName(p);
}

export function toPublicPlayer(p: Player): PublicPlayer {
  return { ...p, displayName: playerDisplayName(p) };
}

export function seatDisplayLabel(seat: Exclude<TableSeat, null>, players: PublicPlayer[]): string {
  if ("name" in seat && seat.name) return seat.name;
  if (!("playerId" in seat)) return "Unknown";
  const p = players.find((x) => x.id === seat.playerId);
  return p?.displayName ?? "Unknown";
}

export function seatPicture(seat: Exclude<TableSeat, null>, players: PublicPlayer[]): string | undefined {
  if ("name" in seat) return undefined;
  if (!("playerId" in seat)) return undefined;
  return players.find((x) => x.id === seat.playerId)?.picture?.trim() || undefined;
}

export type TournamentSeatV2 = { playerId: string };
export type TournamentSeatLegacy = { name: string };
export type TournamentSeat = TournamentSeatV2 | TournamentSeatLegacy | null;

export function tournamentSeatLabel(
  seat: Exclude<TournamentSeat, null>,
  players: PublicPlayer[]
): string {
  if ("name" in seat && seat.name) return seat.name;
  if (!("playerId" in seat)) return "Unknown";
  const p = players.find((x) => x.id === seat.playerId);
  return p?.displayName ?? "Unknown";
}

export function tournamentSeatPicture(
  seat: Exclude<TournamentSeat, null>,
  players: PublicPlayer[]
): string | undefined {
  if ("name" in seat) return undefined;
  if (!("playerId" in seat)) return undefined;
  return players.find((x) => x.id === seat.playerId)?.picture?.trim() || undefined;
}
