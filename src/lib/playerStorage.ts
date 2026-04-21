import { randomUUID } from "crypto";
import type { Redis } from "@upstash/redis";
import type { Player } from "./players";

const KEY = "joes-players";

function normalizeAndMigrate(raw: unknown): { players: Player[]; migrated: boolean } {
  if (!Array.isArray(raw) || raw.length === 0) return { players: [], migrated: false };
  if (typeof (raw as unknown[])[0] === "string") {
    const players = (raw as string[]).map((s) => ({
      id: randomUUID(),
      firstName: String(s).trim(),
      lastName: "",
    }));
    return { players, migrated: true };
  }
  return { players: raw as Player[], migrated: false };
}

/** Reads `joes-players`, migrates legacy string[] to Player[] once, persists if migrated. */
export async function readPlayers(redis: Redis): Promise<Player[]> {
  const raw = await redis.get<Player[] | string[]>(KEY);
  const { players, migrated } = normalizeAndMigrate(raw);
  if (migrated && players.length > 0) await redis.set(KEY, players);
  return players;
}

export async function writePlayers(redis: Redis, players: Player[]): Promise<void> {
  await redis.set(KEY, players);
}
