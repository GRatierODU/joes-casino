import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

type SessionRecord = { name: string; buyin: number; cashout: number; table: number };

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
