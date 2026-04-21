import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const KEY = "joes-players";

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function GET() {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ players: [] });
  const players = (await redis.get<string[]>(KEY)) ?? [];
  return NextResponse.json({ players });
}

export async function POST(request: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { name } = (await request.json()) as { name: string };
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const players = (await redis.get<string[]>(KEY)) ?? [];
  const trimmed = name.trim();
  if (players.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
    return NextResponse.json({ error: "Player already exists" }, { status: 409 });
  }
  players.push(trimmed);
  players.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  await redis.set(KEY, players);
  return NextResponse.json({ players });
}

export async function DELETE(request: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { name } = (await request.json()) as { name: string };
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const players = (await redis.get<string[]>(KEY)) ?? [];
  const updated = players.filter((p) => p.toLowerCase() !== name.trim().toLowerCase());
  await redis.set(KEY, updated);
  return NextResponse.json({ players: updated });
}
