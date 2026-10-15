import { describe, expect, it } from 'vitest';
import {
  coerceProgress, emptyProgress, mergeProgress, recordDaily, recordTypology, statsFromHistory, typologyStats, visibleStreak,
  type DayResult,
} from './progress';

const W = (attempts: number, at = 0): DayResult => ({ won: true, attempts, at });
const L: DayResult = { won: false, attempts: 20 };

describe('daily statistics from history', () => {
  it('counts consecutive won days as a streak', () => {
    const s = statsFromHistory({ '10': W(5), '11': W(7), '13': W(4), '14': L, '15': W(4), '16': W(2) });
    expect(s.played).toBe(6);
    expect(s.won).toBe(5);
    expect(s.maxStreak).toBe(2);
    expect(s.currentStreak).toBe(2);
    expect(s.distribution[3]).toBe(2);
    expect(s.distribution[4]).toBe(1);
  });
  it('shows a broken streak after a missed day', () => {
    const s = statsFromHistory({ '1': W(3), '2': W(3) });
    expect(visibleStreak(s, 3)).toBe(2);
    expect(visibleStreak(s, 4)).toBe(0);
  });
});

describe('merging progress', () => {
  it('unions histories without double counting', () => {
    let a = recordDaily(emptyProgress(), 'normal', 1, W(3, 100));
    a = recordDaily(a, 'normal', 2, W(4, 200));
    let b = recordDaily(emptyProgress(), 'normal', 2, W(9, 150)); // same day played earlier elsewhere
    b = recordDaily(b, 'hard', 2, W(9, 150));
    b = recordTypology(b, 'x', { at: 1, difficulty: 'easy', domain: '', score: 7, total: 10 });
    const m = mergeProgress(a, b);
    expect(Object.keys(m.guess.normal).sort()).toEqual(['1', '2']);
    expect(m.guess.normal['2'].attempts).toBe(9); // the earlier result is kept
    expect(m.guess.hard['2']).toBeDefined();
    expect(m.typology.x.score).toBe(7);
    expect(mergeProgress(m, m)).toEqual(m);
    expect(statsFromHistory(m.guess.normal).played).toBe(2);
  });
  it('never overwrites a recorded day', () => {
    const p = recordDaily(emptyProgress(), 'normal', 5, W(3));
    expect(recordDaily(p, 'normal', 5, L)).toBe(p);
  });
  it('coerces garbage safely', () => {
    expect(coerceProgress(null)).toEqual(emptyProgress());
    expect(coerceProgress({ guess: { normal: { '1': { won: 'yes' } } } })).toEqual(emptyProgress());
  });
});

describe('typology statistics', () => {
  it('computes best, average and distribution', () => {
    let p = emptyProgress();
    p = recordTypology(p, 'a', { at: 1, difficulty: 'easy', domain: '', score: 6, total: 10 });
    p = recordTypology(p, 'b', { at: 2, difficulty: 'hard', domain: '', score: 9, total: 10 });
    const all = typologyStats(p);
    expect(all.played).toBe(2);
    expect(all.best).toBe(9);
    expect(all.average).toBe(7.5);
    expect(typologyStats(p, (r) => r.difficulty === 'easy').best).toBe(6);
  });
});
