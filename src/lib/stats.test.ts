import { describe, expect, it } from 'vitest';
import { emptyStats, recordResult, visibleStreak } from './stats';

describe('player stats', () => {
  it('tracks streaks over consecutive won days', () => {
    let s = emptyStats();
    s = recordResult(s, 10, true, 5);
    s = recordResult(s, 11, true, 7);
    expect(s.currentStreak).toBe(2);
    s = recordResult(s, 11, true, 3); // same day again: ignored
    expect(s.played).toBe(2);
    s = recordResult(s, 13, true, 4); // skipped a day
    expect(s.currentStreak).toBe(1);
    expect(s.maxStreak).toBe(2);
    s = recordResult(s, 14, false, 20);
    expect(s.currentStreak).toBe(0);
    expect(s.distribution[4]).toBe(1);
    expect(s.distribution[3]).toBe(1);
    expect(s.won).toBe(3);
  });
  it('shows a broken streak after a missed day', () => {
    const s = recordResult(recordResult(emptyStats(), 1, true, 3), 2, true, 3);
    expect(visibleStreak(s, 3)).toBe(2);
    expect(visibleStreak(s, 4)).toBe(0);
  });
});
