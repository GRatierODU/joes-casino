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
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function GET(request: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ dates: [], sessions: [] });
  }

  const date = request.nextUrl.searchParams.get("date");

  if (date) {
    const sessions =
      (await redis.get<SessionRecord[]>(`joes-sessions:${date}`)) ?? [];
    return NextResponse.json({ sessions });
  }

  const dates = (await redis.get<string[]>("joes-session-dates")) ?? [];
  return NextResponse.json({ dates });
}

export async function PATCH(request: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { date, index } = await request.json();
  if (!date || typeof index !== "number" || index < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const key = `joes-sessions:${date}`;
  const sessions = (await redis.get<SessionRecord[]>(key)) ?? [];

  if (index >= sessions.length) {
    return NextResponse.json({ error: "Index out of range" }, { status: 400 });
  }

  sessions[index].paid = !sessions[index].paid;
  await redis.set(key, sessions);
  return NextResponse.json({ sessions });
}

export async function DELETE(request: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { date, index } = await request.json();
  if (!date || typeof index !== "number" || index < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const key = `joes-sessions:${date}`;
  const sessions = (await redis.get<SessionRecord[]>(key)) ?? [];

  if (index >= sessions.length) {
    return NextResponse.json({ error: "Index out of range" }, { status: 400 });
  }

  const updated = sessions.filter((_, i) => i !== index);
  if (updated.length === 0) {
    await redis.del(key);
    const dates = (await redis.get<string[]>("joes-session-dates")) ?? [];
    const newDates = dates.filter((d) => d !== date);
    await redis.set("joes-session-dates", newDates);
    return NextResponse.json({ sessions: [], dates: newDates });
  }

  await redis.set(key, updated);
  return NextResponse.json({ sessions: updated });
}
