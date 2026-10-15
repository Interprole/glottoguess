import { MAX_ATTEMPTS } from './game';

export interface PlayerStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  /** last daily puzzle number that was finished (won or lost) */
  lastDay: number | null;
  /** last daily puzzle number that was won */
  lastWonDay: number | null;
  /** distribution[k] = wins using k+1 attempts */
  distribution: number[];
}

export function emptyStats(): PlayerStats {
  return {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastDay: null,
    lastWonDay: null,
    distribution: Array(MAX_ATTEMPTS).fill(0),
  };
}

/**
 * Record a finished daily puzzle. A streak counts consecutive *days won*;
 * finishing the same day twice is a no-op.
 */
export function recordResult(stats: PlayerStats, day: number, won: boolean, attempts: number): PlayerStats {
  if (stats.lastDay != null && day <= stats.lastDay) return stats;
  const s: PlayerStats = { ...stats, distribution: stats.distribution.slice() };
  s.played += 1;
  s.lastDay = day;
  if (won) {
    s.won += 1;
    s.currentStreak = s.lastWonDay === day - 1 ? s.currentStreak + 1 : 1;
    s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
    s.lastWonDay = day;
    const k = Math.min(Math.max(attempts, 1), MAX_ATTEMPTS) - 1;
    s.distribution[k] += 1;
  } else {
    s.currentStreak = 0;
  }
  return s;
}

/** The streak shown today: broken if yesterday's puzzle was not won. */
export function visibleStreak(stats: PlayerStats, today: number): number {
  if (stats.lastWonDay == null) return 0;
  return stats.lastWonDay >= today - 1 ? stats.currentStreak : 0;
}
