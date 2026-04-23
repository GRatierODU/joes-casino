import type { Redis } from "@upstash/redis";

const SESSION_DATES_KEY = "joes-session-dates";

/** One cash-out row stored under `joes-sessions:YYYY-MM-DD` */
export type SessionRow = {
  name: string;
  buyin: number;
  cashout: number;
  table: number;
  paid?: boolean;
  playerId?: string;
};

/**
 * Atomically append a session row and ensure the casino day is listed.
 * Avoids lost updates when two players cash out at the same time (read-modify-write race).
 */
const APPEND_SESSION_LUA = `
local dateKey = KEYS[1]
local datesKey = KEYS[2]
local rowJson = ARGV[1]
local day = ARGV[2]

local raw = redis.call('GET', dateKey)
local t = raw and cjson.decode(raw) or {}
table.insert(t, cjson.decode(rowJson))
redis.call('SET', dateKey, cjson.encode(t))

local datesRaw = redis.call('GET', datesKey)
local dates = datesRaw and cjson.decode(datesRaw) or {}
local seen = false
for i, v in ipairs(dates) do
  if v == day then seen = true break end
end
if not seen then table.insert(dates, 1, day) end
redis.call('SET', datesKey, cjson.encode(dates))

return #t
`;

export async function appendSessionForDay(
  redis: Redis,
  dateKey: string,
  casinoDayISO: string,
  record: SessionRow
): Promise<void> {
  try {
    await redis.eval(APPEND_SESSION_LUA, [dateKey, SESSION_DATES_KEY], [
      JSON.stringify(record),
      casinoDayISO,
    ]);
  } catch {
    const existing = (await redis.get<SessionRow[]>(dateKey)) ?? [];
    existing.push(record);
    await redis.set(dateKey, existing);
    const dates = (await redis.get<string[]>(SESSION_DATES_KEY)) ?? [];
    if (!dates.includes(casinoDayISO)) {
      dates.unshift(casinoDayISO);
      await redis.set(SESSION_DATES_KEY, dates);
    }
  }
}
