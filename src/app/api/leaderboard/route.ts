import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

type Entry = { date: string; name: string; amount: number };

const MAX_ROWS = 26;

const defaultWinners: Entry[] = [
  { date: "2/18", name: "Wes", amount: 160 },
  { date: "4/8", name: "Ethan C", amount: 157.75 },
  { date: "2/1", name: "Joe", amount: 139.25 },
  { date: "2/22", name: "Wes", amount: 122.75 },
  { date: "3/10", name: "Ecass", amount: 109.50 },
  { date: "5/26", name: "Kai", amount: 107.50 },
  { date: "3/5", name: "Joe", amount: 100 },
  { date: "3/4", name: "Semen", amount: 86.50 },
  { date: "12/4", name: "Josh Scherer", amount: 86 },
  { date: "10/19", name: "Seaford", amount: 85.25 },
  { date: "2/9", name: "Joe", amount: 85 },
  { date: "10/29", name: "Joe", amount: 79.50 },
  { date: "1/28", name: "Stephen", amount: 79 },
  { date: "1/24", name: "Joe", amount: 78.50 },
  { date: "3/29", name: "Wes", amount: 77.75 },
  { date: "2/6", name: "Seaford", amount: 75 },
  { date: "1/28", name: "Wes", amount: 74.25 },
  { date: "4/6", name: "Ethan", amount: 73.25 },
  { date: "2/11", name: "Wes", amount: 72.50 },
  { date: "1/29", name: "Harrison", amount: 70.75 },
  { date: "2/18", name: "Jeremy", amount: 70.75 },
  { date: "4/2", name: "Troy", amount: 64 },
  { date: "3/11", name: "Harrison", amount: 62.25 },
  { date: "2/11", name: "Seaford", amount: 61 },
  { date: "10/16", name: "Joe", amount: 59.50 },
  { date: "11/12", name: "Harrison", amount: 57 },
];

const defaultLosers: Entry[] = [
  { date: "2/22", name: "Kai", amount: -80 },
  { date: "2/1", name: "Frenchie", amount: -76 },
  { date: "2/1", name: "Wes", amount: -71 },
  { date: "3/11", name: "Wes", amount: -70 },
  { date: "2/9", name: "Ethan", amount: -65 },
  { date: "3/11", name: "Joe", amount: -60 },
  { date: "3/5", name: "Wes", amount: -60 },
  { date: "3/10", name: "Joe", amount: -58.75 },
  { date: "2/18", name: "Harrison", amount: -55 },
  { date: "4/2", name: "Kai", amount: -50 },
  { date: "2/18", name: "Kai", amount: -50 },
  { date: "3/29", name: "Kai", amount: -50 },
  { date: "4/8", name: "Joe", amount: -50 },
  { date: "3/10", name: "Jerbear", amount: -50 },
  { date: "3/4", name: "Ethan C", amount: -47.25 },
  { date: "3/26", name: "Nathan", amount: -45 },
  { date: "4/6", name: "Wes", amount: -42.25 },
  { date: "3/5", name: "Kai", amount: -41.25 },
  { date: "1/26", name: "Seaford", amount: -40 },
  { date: "4/2", name: "Kai", amount: -40 },
  { date: "4/6", name: "Kai", amount: -40 },
  { date: "3/8", name: "Wes", amount: -40 },
  { date: "4/2", name: "Ecass", amount: -40 },
  { date: "2/18", name: "Avery", amount: -40 },
  { date: "3/8", name: "Kai", amount: -40 },
  { date: "4/2", name: "Kai", amount: -40 },
];

function getRedis(): Redis | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({
      winners: defaultWinners,
      losers: defaultLosers,
    });
  }

  let [winners, losers] = await Promise.all([
    redis.get<Entry[]>("joes-winners"),
    redis.get<Entry[]>("joes-losers"),
  ]);

  if (!winners) {
    winners = defaultWinners;
    await redis.set("joes-winners", winners);
  }
  if (!losers) {
    losers = defaultLosers;
    await redis.set("joes-losers", losers);
  }

  return NextResponse.json({ winners, losers });
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
  const { board, date, name, amount } = body as {
    board: string;
    date: string;
    name: string;
    amount: number;
  };

  if (!board || !date?.trim() || !name?.trim() || !amount || amount === 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const key = board === "winner" ? "joes-winners" : "joes-losers";
  const existing = (await redis.get<Entry[]>(key)) ??
    (board === "winner" ? defaultWinners : defaultLosers);

  const entry: Entry = {
    date: date.trim(),
    name: name.trim(),
    amount: board === "winner" ? Math.abs(amount) : -Math.abs(amount),
  };

  const updated = [...existing, entry]
    .sort((a, b) =>
      board === "winner" ? b.amount - a.amount : a.amount - b.amount
    )
    .slice(0, MAX_ROWS);

  await redis.set(key, updated);

  const otherKey = board === "winner" ? "joes-losers" : "joes-winners";
  const other = (await redis.get<Entry[]>(otherKey)) ??
    (board === "winner" ? defaultLosers : defaultWinners);

  return NextResponse.json({
    winners: board === "winner" ? updated : other,
    losers: board === "loser" ? updated : other,
  });
}
