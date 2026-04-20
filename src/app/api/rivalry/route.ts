import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

type RivalryData = { avery: number; wes: number };

const KEY = "joes-rivalry";
const DEFAULT: RivalryData = { avery: 0, wes: 35 };

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function GET() {
  const redis = getRedis();
  if (!redis) return NextResponse.json(DEFAULT);
  const data = await redis.get<RivalryData>(KEY);
  return NextResponse.json(data ?? DEFAULT);
}

export async function POST(request: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await request.json();
  const { avery, wes } = body as { avery?: number; wes?: number };

  const current = (await redis.get<RivalryData>(KEY)) ?? DEFAULT;
  if (typeof avery === "number" && avery >= 0) current.avery = avery;
  if (typeof wes === "number" && wes >= 0) current.wes = wes;

  await redis.set(KEY, current);
  return NextResponse.json(current);
}
