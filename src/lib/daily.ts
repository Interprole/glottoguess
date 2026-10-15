import { hashString, mulberry32, shuffle } from './random';

const DAY_MS = 86_400_000;
/** Puzzle #1 is the day of launch (UTC). */
export const EPOCH_UTC = Date.UTC(2026, 9, 15);

/** Day number in UTC: the puzzle changes at 00:00 UTC for everybody. */
export function dayNumber(now: Date | number = Date.now()): number {
  const t = typeof now === 'number' ? now : now.getTime();
  return Math.floor((t - EPOCH_UTC) / DAY_MS) + 1;
}

/** Milliseconds until the next 00:00 UTC. */
export function msUntilNextPuzzle(now: number = Date.now()): number {
  return DAY_MS - ((((now - EPOCH_UTC) % DAY_MS) + DAY_MS) % DAY_MS);
}

/** Deterministic permutation of the pool for a given cycle. */
function cycleOrder(sortedPool: readonly string[], salt: string, cycle: number): string[] {
  return shuffle(sortedPool, mulberry32(hashString(`${salt}:${cycle}`)));
}

/**
 * The daily answer.
 *
 * The (sorted) pool is shuffled with a seed derived from ``salt`` and the
 * cycle number; day *n* takes item *n mod N* of its cycle. Within a cycle of
 * N days no language repeats, and the first item of a cycle is never the
 * same as the last item of the previous one.
 */
export function dailyAnswer(pool: readonly string[], day: number, salt: string): string {
  if (pool.length === 0) throw new Error('empty pool');
  const sorted = [...pool].sort();
  const n = sorted.length;
  const idx = (((day - 1) % n) + n) % n;
  const cycle = Math.floor((day - 1) / n);
  const order = cycleOrder(sorted, salt, cycle);
  if (n > 1) {
    const prevLast = cycleOrder(sorted, salt, cycle - 1)[n - 1];
    if (order[0] === prevLast) [order[0], order[1]] = [order[1], order[0]];
  }
  return order[idx];
}
