import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import {
  parseBadBeatCard,
  parseBeatDateInput,
  type BadBeatEntry,
  type BadBeatSeatRow,
  type BadBeatTableV2,
} from "@/lib/badBeatCards";
import { sessionCalendarDateISO } from "@/lib/sessionDate";

const REDIS_KEY = "joes-bad-beats";

function getRedis(): Redis | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function validateNoDupes(
  seats: BadBeatSeatRow[],
  board: [string, string, string, string, string]
): boolean {
  const s = new Set<string>();
  for (const row of seats) {
    for (const c of row.hole) {
      const p = parseBadBeatCard(c);
      if (!p) return false;
      if (s.has(p)) return false;
      s.add(p);
    }
  }
  for (const c of board) {
    const p = parseBadBeatCard(c);
    if (!p) return false;
    if (s.has(p)) return false;
    s.add(p);
  }
  return true;
}

function parseTablePayload(body: unknown):
  | { ok: true; seats: BadBeatSeatRow[]; board: BadBeatTableV2["board"] }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body." };
  }
  const { seats, board } = body as { seats?: unknown; board?: unknown };
  if (!Array.isArray(seats) || seats.length === 0) {
    return { ok: false, error: "Add at least one player with two cards." };
  }
  if (!Array.isArray(board) || board.length !== 5) {
    return { ok: false, error: "Board must have exactly five cards." };
  }

  const seenSeat = new Set<number>();
  const normSeats: BadBeatSeatRow[] = [];

  for (const raw of seats) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as { seat?: unknown; name?: unknown; hole?: unknown };
    const seat = typeof o.seat === "number" ? o.seat : Number(o.seat);
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!Number.isInteger(seat) || seat < 0 || seat > 9) {
      return { ok: false, error: "Each seat must be between 0 and 9." };
    }
    if (seenSeat.has(seat)) {
      return { ok: false, error: "Duplicate seat in payload." };
    }
    seenSeat.add(seat);
    if (!name) {
      return { ok: false, error: "Each player needs a name." };
    }
    if (!Array.isArray(o.hole) || o.hole.length !== 2) {
      return { ok: false, error: "Each player needs exactly two hole cards." };
    }
    const h0 = parseBadBeatCard(String(o.hole[0] ?? ""));
    const h1 = parseBadBeatCard(String(o.hole[1] ?? ""));
    if (!h0 || !h1) {
      return { ok: false, error: "Invalid hole card." };
    }
    normSeats.push({ seat, name, hole: [h0, h1] });
  }

  if (normSeats.length === 0) {
    return { ok: false, error: "Add at least one player with two cards." };
  }

  const normBoard: [string, string, string, string, string] = ["", "", "", "", ""];
  for (let i = 0; i < 5; i++) {
    const p = parseBadBeatCard(String(board[i] ?? ""));
    if (!p) {
      return { ok: false, error: `Board slot ${i + 1} needs a valid card.` };
    }
    normBoard[i] = p;
  }

  if (!validateNoDupes(normSeats, normBoard)) {
    return { ok: false, error: "Duplicate cards are not allowed." };
  }

  return { ok: true, seats: normSeats, board: normBoard };
}

export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ entries: [] as BadBeatEntry[] });
  }
  const entries = (await redis.get<BadBeatEntry[]>(REDIS_KEY)) ?? [];
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  const body = await request.json();
  const parsed = parseTablePayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const beatRaw = (body as { beatDate?: unknown }).beatDate;
  let beatDate: string;
  if (typeof beatRaw === "string" && beatRaw.trim()) {
    const p = parseBeatDateInput(beatRaw);
    if (!p) {
      return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
    }
    beatDate = p;
  } else {
    beatDate = sessionCalendarDateISO();
  }

  const entry: BadBeatTableV2 = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    v: 2,
    beatDate,
    seats: parsed.seats,
    board: parsed.board,
  };

  const existing = (await redis.get<BadBeatEntry[]>(REDIS_KEY)) ?? [];
  const updated = [entry, ...existing];
  await redis.set(REDIS_KEY, updated);

  return NextResponse.json({ entries: updated });
}

export async function DELETE(request: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  const { id } = (await request.json()) as { id?: string };
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = (await redis.get<BadBeatEntry[]>(REDIS_KEY)) ?? [];
  const updated = existing.filter((e) => e.id !== id);
  if (updated.length === existing.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await redis.set(REDIS_KEY, updated);
  return NextResponse.json({ entries: updated });
}
