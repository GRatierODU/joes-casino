/** 1st 50%, 2nd 30%, 3rd 20% of total pot; cents sum to totalPot */
export function withTopThreePayouts(
  players: { name: string; placement: number }[],
  totalPot: number
): { name: string; placement: number; payout: number }[] {
  const third = Math.round(totalPot * 0.2 * 100) / 100;
  const second = Math.round(totalPot * 0.3 * 100) / 100;
  const first = Math.round((totalPot - second - third) * 100) / 100;
  const byPlace: Record<number, number> = { 1: first, 2: second, 3: third };
  return players.map((p) => ({
    ...p,
    payout: byPlace[p.placement] ?? 0,
  }));
}
