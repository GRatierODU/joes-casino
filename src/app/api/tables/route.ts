import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { playerDisplayName } from "@/lib/players";
import { readPlayers } from "@/lib/playerStorage";
import { appendSessionForDay } from "@/lib/sessionAppend";
import { sessionCalendarDateISO } from "@/lib/sessionDate";

type SeatV2 = { playerId: string; buyin: number };
type SeatLegacy = { name: string; buyin: number };
type Seat = SeatV2 | SeatLegacy | null;

type TablesState = { tables: [Seat[], Seat[]] };
type SessionRecord = {
  name: string;
  buyin: number;
  cashout: number;
  table: number;
  paid?: boolean;
  playerId?: string;
};

const EMPTY_STATE: TablesState = {
  tables: [Array(10).fill(null), Array(10).fill(null)],
};

function getRedis(): Redis | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function getState(redis: Redis): Promise<TablesState> {
  const data = await redis.get<TablesState>("joes-tables");
  if (!data) return EMPTY_STATE;
  for (let t = 0; t < data.tables.length; t++) {
    while (data.tables[t].length < 10) {
      data.tables[t].push(null);
    }
  }
  return data;
}

export async function GET() {
  const redis = getRedis();
  if (!redis) return NextResponse.json(EMPTY_STATE);
  const state = await getState(redis);
  return NextResponse.json(state);
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
  const { action, table, seat } = body as {
    action: string;
    table: number;
    seat: number;
  };

  if (
    !action ||
    typeof table !== "number" ||
    typeof seat !== "number" ||
    table < 0 ||
    table > 1 ||
    seat < 0 ||
    seat > 9
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const state = await getState(redis);

  if (action === "sit") {
    const { playerId, buyin } = body as { playerId: string; buyin: number };
    if (typeof playerId !== "string" || !playerId || typeof buyin !== "number" || buyin <= 0) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (state.tables[table][seat] !== null) {
      return NextResponse.json({ error: "Seat taken" }, { status: 409 });
    }
    const players = await readPlayers(redis);
    if (!players.some((p) => p.id === playerId)) {
      return NextResponse.json({ error: "Unknown player" }, { status: 400 });
    }
    state.tables[table][seat] = { playerId, buyin };
  } else if (action === "update") {
    const { buyin } = body as { buyin: number };
    if (typeof buyin !== "number" || buyin <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const current = state.tables[table][seat];
    if (!current) {
      return NextResponse.json({ error: "Seat is empty" }, { status: 400 });
    }
    current.buyin += buyin;
  } else if (action === "leave") {
    const current = state.tables[table][seat];
    if (current) {
      const { cashout } = body as { cashout: number };
      const co = typeof cashout === "number" && cashout >= 0 ? cashout : 0;
      const casinoDay = sessionCalendarDateISO();
      const dateKey = `joes-sessions:${casinoDay}`;

      let displayName: string;
      let playerId: string | undefined;
      if ("playerId" in current && current.playerId) {
        const players = await readPlayers(redis);
        const p = players.find((x) => x.id === current.playerId);
        displayName = p ? playerDisplayName(p) : "Unknown";
        playerId = current.playerId;
      } else {
        displayName = (current as SeatLegacy).name;
        playerId = undefined;
      }

      const record: SessionRecord = {
        name: displayName,
        playerId,
        buyin: current.buyin,
        cashout: co,
        table,
      };
      await appendSessionForDay(redis, dateKey, casinoDay, record);
    }
    state.tables[table][seat] = null;
  } else if (action === "move") {
    const { toTable, toSeat } = body as { toTable: number; toSeat: number };
    if (
      typeof toTable !== "number" ||
      typeof toSeat !== "number" ||
      toTable < 0 || toTable > 1 ||
      toSeat < 0 || toSeat > 9
    ) {
      return NextResponse.json({ error: "Invalid destination" }, { status: 400 });
    }
    const current = state.tables[table][seat];
    if (!current) {
      return NextResponse.json({ error: "Seat is empty" }, { status: 400 });
    }
    if (state.tables[toTable][toSeat] !== null) {
      return NextResponse.json({ error: "Destination seat taken" }, { status: 409 });
    }
    state.tables[toTable][toSeat] = current;
    state.tables[table][seat] = null;
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await redis.set("joes-tables", state);
  return NextResponse.json(state);
}
