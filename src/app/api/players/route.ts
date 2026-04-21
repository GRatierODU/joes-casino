import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { playerDisplayName, type Player } from "@/lib/players";
import { readPlayers, writePlayers } from "@/lib/playerStorage";

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function toPublic(p: Player) {
  return { ...p, displayName: playerDisplayName(p) };
}

export async function GET() {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ players: [] });
  const players = await readPlayers(redis);
  return NextResponse.json({ players: players.map(toPublic) });
}

export async function POST(request: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = (await request.json()) as {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    picture?: string;
  };

  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }

  const nickname = body.nickname?.trim() || undefined;
  const picture = body.picture?.trim() || undefined;
  if (picture && !/^https?:\/\//i.test(picture)) {
    return NextResponse.json({ error: "Picture must be an http(s) URL" }, { status: 400 });
  }

  const players = await readPlayers(redis);
  const id = randomUUID();
  players.push({ id, firstName, lastName, nickname, picture });
  players.sort((a, b) => {
    const da = playerDisplayName(a).toLowerCase();
    const db = playerDisplayName(b).toLowerCase();
    return da.localeCompare(db);
  });
  await writePlayers(redis, players);
  return NextResponse.json({ players: players.map(toPublic), createdId: id });
}

export async function PATCH(request: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = (await request.json()) as {
    id?: string;
    firstName?: string;
    lastName?: string;
    nickname?: string | null;
    picture?: string | null;
  };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }

  const nickname = body.nickname === null || body.nickname === "" ? undefined : body.nickname?.trim();
  const picture =
    body.picture === null || body.picture === "" ? undefined : body.picture?.trim();
  if (picture && !/^https?:\/\//i.test(picture)) {
    return NextResponse.json({ error: "Picture must be an http(s) URL" }, { status: 400 });
  }

  const players = await readPlayers(redis);
  const idx = players.findIndex((p) => p.id === body.id);
  if (idx < 0) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  players[idx] = { id: body.id, firstName, lastName, nickname, picture };
  players.sort((a, b) =>
    playerDisplayName(a).toLowerCase().localeCompare(playerDisplayName(b).toLowerCase())
  );
  await writePlayers(redis, players);
  return NextResponse.json({ players: players.map(toPublic) });
}

export async function DELETE(request: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { id } = (await request.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const players = await readPlayers(redis);
  const updated = players.filter((p) => p.id !== id);
  if (updated.length === players.length) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  await writePlayers(redis, updated);
  return NextResponse.json({ players: updated.map(toPublic) });
}
