import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

type SessionRecord = {
  name: string;
  buyin: number;
  cashout: number;
  table: number;
  paid?: boolean;
  playerId?: string;
};

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

type PlayerStats = {
  playerId?: string;
  name: string;
  totalSessions: number;
  totalBuyin: number;
  totalCashout: number;
  totalPL: number;
  avgBuyin: number;
  avgPL: number;
  bestSession: number;
  worstSession: number;
};

type SessionWithDate = SessionRecord & { date: string };

function groupKey(s: SessionRecord): string {
  if (s.playerId) return `id:${s.playerId}`;
  return `legacy:${s.name.toLowerCase()}`;
}

async function getAllSessions(redis: Redis): Promise<SessionWithDate[]> {
  const dates = (await redis.get<string[]>("joes-session-dates")) ?? [];
  const all: SessionWithDate[] = [];
  for (const date of dates) {
    const records = (await redis.get<SessionRecord[]>(`joes-sessions:${date}`)) ?? [];
    for (const r of records) {
      all.push({ ...r, date });
    }
  }
  return all;
}

function computeStats(sessions: SessionWithDate[]): PlayerStats[] {
  const map = new Map<string, SessionWithDate[]>();
  for (const s of sessions) {
    const key = groupKey(s);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }

  const stats: PlayerStats[] = [];
  for (const [, records] of map) {
    const name = records[0].name;
    const playerId = records[0].playerId;
    const totalBuyin = records.reduce((sum, r) => sum + r.buyin, 0);
    const totalCashout = records.reduce((sum, r) => sum + r.cashout, 0);
    const pls = records.map((r) => r.cashout - r.buyin);
    const totalPL = totalCashout - totalBuyin;
    stats.push({
      playerId,
      name,
      totalSessions: records.length,
      totalBuyin,
      totalCashout,
      totalPL,
      avgBuyin: totalBuyin / records.length,
      avgPL: totalPL / records.length,
      bestSession: Math.max(...pls),
      worstSession: Math.min(...pls),
    });
  }
  stats.sort((a, b) => b.totalPL - a.totalPL);
  return stats;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ stats: [], sessions: [] });

  const playerIdParam = request.nextUrl.searchParams.get("playerId");
  const legacyName = request.nextUrl.searchParams.get("legacyName");
  const allSessions = await getAllSessions(redis);

  if (playerIdParam) {
    const playerSessions = allSessions
      .filter((s) => s.playerId === playerIdParam)
      .sort((a, b) => b.date.localeCompare(a.date));
    const playerStats = computeStats(playerSessions);
    return NextResponse.json({
      stats: playerStats[0] ?? null,
      sessions: playerSessions,
    });
  }

  if (legacyName) {
    const needle = legacyName.toLowerCase();
    const playerSessions = allSessions
      .filter((s) => !s.playerId && s.name.toLowerCase() === needle)
      .sort((a, b) => b.date.localeCompare(a.date));
    const playerStats = computeStats(playerSessions);
    return NextResponse.json({
      stats: playerStats[0] ?? null,
      sessions: playerSessions,
    });
  }

  /** Back-compat: `?player=` is either a playerId (UUID) or a legacy display name */
  const player = request.nextUrl.searchParams.get("player");
  if (player) {
    if (UUID_RE.test(player)) {
      const playerSessions = allSessions
        .filter((s) => s.playerId === player)
        .sort((a, b) => b.date.localeCompare(a.date));
      const playerStats = computeStats(playerSessions);
      return NextResponse.json({
        stats: playerStats[0] ?? null,
        sessions: playerSessions,
      });
    }
    const needle = player.toLowerCase();
    const playerSessions = allSessions
      .filter((s) => !s.playerId && s.name.toLowerCase() === needle)
      .sort((a, b) => b.date.localeCompare(a.date));
    const playerStats = computeStats(playerSessions);
    return NextResponse.json({
      stats: playerStats[0] ?? null,
      sessions: playerSessions,
    });
  }

  const stats = computeStats(allSessions);
  return NextResponse.json({ stats });
}
