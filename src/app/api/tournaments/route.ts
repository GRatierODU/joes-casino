import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import { playerDisplayName } from "@/lib/players";
import { readPlayers } from "@/lib/playerStorage";
import {
  BLIND_DURATION,
  resolveTournamentSchedule,
  TOURNAMENT_SCHEDULE_VERSION,
} from "@/lib/tournamentBlinds";
import { withTopThreePayouts } from "@/lib/tournamentPayouts";

type TournamentSeat = { playerId: string } | { name: string } | null;

type TournamentState = {
  started: boolean;
  buyin: number;
  tables: [TournamentSeat[], TournamentSeat[]];
  blindLevel: number;
  blindStartedAt: number;
  paused: boolean;
  pausedRemaining: number;
  busted: { name: string; placement: number }[];
  registeredCount: number;
  createdAt: string;
  /** New tournaments only; omitted = legacy blind structure + 15 min levels */
  scheduleVersion?: number;
};

type TournamentResult = {
  date: string;
  buyin: number;
  players: { name: string; placement: number; payout?: number }[];
  totalPot: number;
};

const ACTIVE_KEY = "joes-tournament-active";
const HISTORY_KEY = "joes-tournament-history";

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function tournamentSeatDisplayName(redis: Redis, seat: NonNullable<TournamentSeat>): Promise<string> {
  if ("name" in seat && seat.name) return seat.name;
  if (!("playerId" in seat)) return "Unknown";
  const players = await readPlayers(redis);
  const p = players.find((x) => x.id === seat.playerId);
  return p ? playerDisplayName(p) : "Unknown";
}

function autoAdvanceBlinds(state: TournamentState): boolean {
  const { levels, duration } = resolveTournamentSchedule(state);
  if (!state.started || state.paused) return false;
  if (state.blindLevel >= levels.length - 1) return false;
  const now = Date.now();
  const elapsed = (now - state.blindStartedAt) / 1000;
  const levelsToAdvance = Math.floor(elapsed / duration);
  if (levelsToAdvance > 0) {
    const newLevel = Math.min(state.blindLevel + levelsToAdvance, levels.length - 1);
    const actual = newLevel - state.blindLevel;
    state.blindLevel = newLevel;
    state.blindStartedAt += actual * duration * 1000;
    return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const redis = getRedis();
  const wantHistory = request.nextUrl.searchParams.get("history");

  if (!redis) {
    if (wantHistory) return NextResponse.json({ history: [] });
    const def = resolveTournamentSchedule({ scheduleVersion: TOURNAMENT_SCHEDULE_VERSION });
    return NextResponse.json({
      state: null,
      blindLevels: def.levels,
      blindDuration: def.duration,
    });
  }

  if (wantHistory) {
    const history = (await redis.get<TournamentResult[]>(HISTORY_KEY)) ?? [];
    return NextResponse.json({ history });
  }

  const state = await redis.get<TournamentState>(ACTIVE_KEY);
  if (state) {
    const changed = autoAdvanceBlinds(state);
    if (changed) await redis.set(ACTIVE_KEY, state);
  }
  const resolved = state
    ? resolveTournamentSchedule(state)
    : resolveTournamentSchedule({ scheduleVersion: TOURNAMENT_SCHEDULE_VERSION });
  return NextResponse.json({
    state,
    blindLevels: resolved.levels,
    blindDuration: resolved.duration,
  });
}

export async function POST(request: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await request.json();
  const { action } = body as { action: string };

  if (action === "create") {
    const { buyin } = body as { buyin: number };
    if (typeof buyin !== "number" || buyin <= 0) {
      return NextResponse.json({ error: "Invalid buy-in" }, { status: 400 });
    }
    const existing = await redis.get<TournamentState>(ACTIVE_KEY);
    if (existing) return NextResponse.json({ error: "Tournament already active" }, { status: 409 });
    const state: TournamentState = {
      started: false,
      buyin,
      tables: [Array(10).fill(null), Array(10).fill(null)],
      blindLevel: 0,
      blindStartedAt: 0,
      paused: false,
      pausedRemaining: BLIND_DURATION,
      busted: [],
      registeredCount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      scheduleVersion: TOURNAMENT_SCHEDULE_VERSION,
    };
    await redis.set(ACTIVE_KEY, state);
    return NextResponse.json({ state });
  }

  const state = await redis.get<TournamentState>(ACTIVE_KEY);
  if (!state) return NextResponse.json({ error: "No active tournament" }, { status: 404 });
  autoAdvanceBlinds(state);
  const { duration: blindDurationSec } = resolveTournamentSchedule(state);

  if (action === "register") {
    if (state.started) return NextResponse.json({ error: "Tournament already started" }, { status: 400 });
    const { table, seat, playerId } = body as { table: number; seat: number; playerId: string };
    if (typeof table !== "number" || typeof seat !== "number" || typeof playerId !== "string" || !playerId.trim() ||
        table < 0 || table > 1 || seat < 0 || seat > 9) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const players = await readPlayers(redis);
    if (!players.some((p) => p.id === playerId)) {
      return NextResponse.json({ error: "Unknown player" }, { status: 400 });
    }
    if (state.tables[table][seat] !== null) return NextResponse.json({ error: "Seat taken" }, { status: 409 });
    state.tables[table][seat] = { playerId: playerId.trim() };
    state.registeredCount++;
    await redis.set(ACTIVE_KEY, state);
    return NextResponse.json({ state });
  }

  if (action === "unregister") {
    if (state.started) return NextResponse.json({ error: "Tournament already started" }, { status: 400 });
    const { table, seat } = body as { table: number; seat: number };
    if (typeof table !== "number" || typeof seat !== "number" ||
        table < 0 || table > 1 || seat < 0 || seat > 9) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (!state.tables[table][seat]) return NextResponse.json({ error: "Seat is empty" }, { status: 400 });
    state.tables[table][seat] = null;
    state.registeredCount--;
    await redis.set(ACTIVE_KEY, state);
    return NextResponse.json({ state });
  }

  if (action === "start") {
    if (state.started) return NextResponse.json({ error: "Already started" }, { status: 400 });
    if (state.registeredCount < 2) return NextResponse.json({ error: "Need at least 2 players" }, { status: 400 });
    state.started = true;
    state.blindLevel = 0;
    state.blindStartedAt = Date.now();
    state.paused = false;
    state.pausedRemaining = blindDurationSec;
    await redis.set(ACTIVE_KEY, state);
    return NextResponse.json({ state });
  }

  if (action === "bust") {
    if (!state.started) return NextResponse.json({ error: "Not started" }, { status: 400 });
    const { table, seat } = body as { table: number; seat: number };
    if (typeof table !== "number" || typeof seat !== "number" ||
        table < 0 || table > 1 || seat < 0 || seat > 9) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const player = state.tables[table][seat];
    if (!player) return NextResponse.json({ error: "Seat is empty" }, { status: 400 });

    const placement = state.registeredCount - state.busted.length;
    const bustName = await tournamentSeatDisplayName(redis, player);
    state.busted.push({ name: bustName, placement });
    state.tables[table][seat] = null;

    const remaining = state.tables.flat().filter((s): s is NonNullable<TournamentSeat> => s !== null);
    if (remaining.length === 1) {
      const winName = await tournamentSeatDisplayName(redis, remaining[0]);
      state.busted.push({ name: winName, placement: 1 });
      for (let t = 0; t < 2; t++) for (let s = 0; s < 10; s++) state.tables[t][s] = null;
      const sorted = [...state.busted].sort((a, b) => a.placement - b.placement);
      const totalPot = state.buyin * state.registeredCount;
      const result: TournamentResult = {
        date: state.createdAt,
        buyin: state.buyin,
        players: withTopThreePayouts(sorted, totalPot),
        totalPot,
      };
      const history = (await redis.get<TournamentResult[]>(HISTORY_KEY)) ?? [];
      history.unshift(result);
      await redis.set(HISTORY_KEY, history);
      await redis.del(ACTIVE_KEY);
      return NextResponse.json({ state: null, result, finished: true });
    }
    if (remaining.length === 0) {
      const sorted = [...state.busted].sort((a, b) => a.placement - b.placement);
      const totalPot = state.buyin * state.registeredCount;
      const result: TournamentResult = {
        date: state.createdAt,
        buyin: state.buyin,
        players: withTopThreePayouts(sorted, totalPot),
        totalPot,
      };
      const history = (await redis.get<TournamentResult[]>(HISTORY_KEY)) ?? [];
      history.unshift(result);
      await redis.set(HISTORY_KEY, history);
      await redis.del(ACTIVE_KEY);
      return NextResponse.json({ state: null, result, finished: true });
    }

    await redis.set(ACTIVE_KEY, state);
    return NextResponse.json({ state });
  }

  if (action === "move") {
    const { table, seat, toTable, toSeat } = body as { table: number; seat: number; toTable: number; toSeat: number };
    if (typeof table !== "number" || typeof seat !== "number" ||
        typeof toTable !== "number" || typeof toSeat !== "number" ||
        table < 0 || table > 1 || seat < 0 || seat > 9 ||
        toTable < 0 || toTable > 1 || toSeat < 0 || toSeat > 9) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const player = state.tables[table][seat];
    if (!player) return NextResponse.json({ error: "Seat is empty" }, { status: 400 });
    if (state.tables[toTable][toSeat] !== null) return NextResponse.json({ error: "Destination taken" }, { status: 409 });
    state.tables[toTable][toSeat] = player;
    state.tables[table][seat] = null;
    await redis.set(ACTIVE_KEY, state);
    return NextResponse.json({ state });
  }

  if (action === "pause") {
    if (!state.started) return NextResponse.json({ error: "Not started" }, { status: 400 });
    if (state.paused) {
      state.paused = false;
      state.blindStartedAt = Date.now() - (blindDurationSec - state.pausedRemaining) * 1000;
    } else {
      const elapsed = (Date.now() - state.blindStartedAt) / 1000;
      state.pausedRemaining = Math.max(0, blindDurationSec - elapsed);
      state.paused = true;
    }
    await redis.set(ACTIVE_KEY, state);
    return NextResponse.json({ state });
  }

  if (action === "cancel") {
    await redis.del(ACTIVE_KEY);
    return NextResponse.json({ state: null });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { index } = await request.json();
  if (typeof index !== "number" || index < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const history = (await redis.get<TournamentResult[]>(HISTORY_KEY)) ?? [];
  if (index >= history.length) return NextResponse.json({ error: "Index out of range" }, { status: 400 });
  history.splice(index, 1);
  await redis.set(HISTORY_KEY, history);
  return NextResponse.json({ history });
}
