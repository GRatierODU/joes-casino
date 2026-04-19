import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

type Seat = { name: string; buyin: number } | null;
type TablesState = { tables: [Seat[], Seat[]] };
type SessionRecord = { name: string; buyin: number; cashout: number; table: number };

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
  return data ?? EMPTY_STATE;
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
    const { name, buyin } = body as { name: string; buyin: number };
    if (!name?.trim() || typeof buyin !== "number" || buyin <= 0) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (state.tables[table][seat] !== null) {
      return NextResponse.json({ error: "Seat taken" }, { status: 409 });
    }
    state.tables[table][seat] = { name: name.trim(), buyin };
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
      const today = new Date().toISOString().slice(0, 10);
      const dateKey = `joes-sessions:${today}`;
      const record: SessionRecord = {
        name: current.name,
        buyin: current.buyin,
        cashout: co,
        table,
      };
      const existing = (await redis.get<SessionRecord[]>(dateKey)) ?? [];
      existing.push(record);
      await redis.set(dateKey, existing);
      const dates = (await redis.get<string[]>("joes-session-dates")) ?? [];
      if (!dates.includes(today)) {
        dates.unshift(today);
        await redis.set("joes-session-dates", dates);
      }
    }
    state.tables[table][seat] = null;
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await redis.set("joes-tables", state);
  return NextResponse.json(state);
}
