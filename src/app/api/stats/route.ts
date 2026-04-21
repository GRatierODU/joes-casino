import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

type SessionRecord = { name: string; buyin: number; cashout: number; table: number; paid?: boolean };

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

type PlayerStats = {
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
    const key = s.name.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }

  const stats: PlayerStats[] = [];
  for (const [, records] of map) {
    const name = records[0].name;
    const totalBuyin = records.reduce((sum, r) => sum + r.buyin, 0);
    const totalCashout = records.reduce((sum, r) => sum + r.cashout, 0);
    const pls = records.map((r) => r.cashout - r.buyin);
    const totalPL = totalCashout - totalBuyin;
    stats.push({
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

export async function GET(request: NextRequest) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ stats: [], sessions: [] });

  const player = request.nextUrl.searchParams.get("player");
  const allSessions = await getAllSessions(redis);

  if (player) {
    const playerSessions = allSessions
      .filter((s) => s.name.toLowerCase() === player.toLowerCase())
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
