import { describe, expect, it } from 'vitest';
import { dailyAnswer, dayNumber, EPOCH_UTC, msUntilNextPuzzle } from './daily';

const pool = Array.from({ length: 50 }, (_, i) => `lang${String(i).padStart(4, '0')}`);

describe('daily puzzle', () => {
  it('numbers days in UTC, changing exactly at midnight UTC', () => {
    expect(dayNumber(EPOCH_UTC)).toBe(1);
    expect(dayNumber(EPOCH_UTC + 86_400_000 - 1)).toBe(1);
    expect(dayNumber(EPOCH_UTC + 86_400_000)).toBe(2);
    // the same instant gives the same puzzle regardless of the local time zone
    expect(dayNumber(new Date('2026-10-16T23:30:00-05:00'))).toBe(dayNumber(new Date('2026-10-17T04:30:00Z')));
    expect(msUntilNextPuzzle(EPOCH_UTC + 1000)).toBe(86_400_000 - 1000);
  });

  it('is deterministic and independent of pool order', () => {
    const shuffled = [...pool].reverse();
    for (let d = 1; d < 120; d++) expect(dailyAnswer(pool, d, 'x')).toBe(dailyAnswer(shuffled, d, 'x'));
  });

  it('never repeats within a cycle and covers the whole pool', () => {
    for (const cycle of [0, 1, 7]) {
      const seen = new Set<string>();
      for (let d = 1; d <= pool.length; d++) seen.add(dailyAnswer(pool, cycle * pool.length + d, 'x'));
      expect(seen.size).toBe(pool.length);
    }
  });

  it('does not repeat across a cycle boundary', () => {
    for (let c = 1; c < 30; c++) {
      const last = dailyAnswer(pool, c * pool.length, 'x');
      const first = dailyAnswer(pool, c * pool.length + 1, 'x');
      expect(first).not.toBe(last);
    }
  });

  it('gives different sequences for different difficulty salts', () => {
    const a = Array.from({ length: 10 }, (_, d) => dailyAnswer(pool, d + 1, 'normal'));
    const b = Array.from({ length: 10 }, (_, d) => dailyAnswer(pool, d + 1, 'hard'));
    expect(a).not.toEqual(b);
  });
});
