/**
 * Player progress as a *history of results*, not as counters, so that two
 * copies (this browser and the cloud, or two devices) can always be merged
 * without double counting: results are keyed by puzzle day / game id.
 */
import type { HintKind } from './game';
import { MAX_ATTEMPTS } from './game';
import type { Difficulty } from './types';

export interface DayResult {
  won: boolean;
  /** attempts used, hints included */
  attempts: number;
  gaveUp?: boolean;
  /** enough to restore the finished board on another device */
  target?: string;
  guesses?: string[];
  hints?: HintKind[];
  at?: number;
}

export interface TypoResult {
  at: number;
  difficulty: 'easy' | 'hard';
  domain: string;
  score: number;
  total: number;
  duel?: string;
}

export interface Progress {
  v: 1;
  guess: Record<Difficulty, Record<string, DayResult>>;
  typology: Record<string, TypoResult>;
  /** ids of duels this player created or joined */
  duels: Record<string, number>;
}

export function emptyProgress(): Progress {
  return { v: 1, guess: { normal: {}, hard: {} }, typology: {}, duels: {} };
}

/** Normalise anything read from storage / the network into a valid Progress. */
export function coerceProgress(x: unknown): Progress {
  const p = emptyProgress();
  if (!x || typeof x !== 'object') return p;
  const o = x as Partial<Progress>;
  for (const d of ['normal', 'hard'] as const) {
    const src = o.guess?.[d];
    if (src && typeof src === 'object') {
      for (const [day, r] of Object.entries(src)) {
        if (r && typeof r === 'object' && typeof r.won === 'boolean' && typeof r.attempts === 'number') p.guess[d][day] = r;
      }
    }
  }
  if (o.typology && typeof o.typology === 'object') {
    for (const [id, r] of Object.entries(o.typology)) {
      if (r && typeof r === 'object' && typeof r.score === 'number' && typeof r.total === 'number') p.typology[id] = r;
    }
  }
  if (o.duels && typeof o.duels === 'object') {
    for (const [id, at] of Object.entries(o.duels)) if (typeof at === 'number') p.duels[id] = at;
  }
  return p;
}

/** Union of two histories. For the same puzzle day the earlier-recorded result wins. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const out = emptyProgress();
  for (const d of ['normal', 'hard'] as const) {
    out.guess[d] = { ...b.guess[d] };
    for (const [day, r] of Object.entries(a.guess[d])) {
      const other = out.guess[d][day];
      if (!other || (r.at ?? 0) <= (other.at ?? Infinity)) out.guess[d][day] = r;
    }
  }
  out.typology = { ...b.typology, ...a.typology };
  out.duels = { ...b.duels, ...a.duels };
  return out;
}

export function progressEquals(a: Progress, b: Progress): boolean {
  return JSON.stringify(sortDeep(a)) === JSON.stringify(sortDeep(b));
}

function sortDeep(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(sortDeep);
  if (x && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortDeep(v)]));
  }
  return x;
}

/** Record a finished daily puzzle; a day that already has a result is never overwritten. */
export function recordDaily(p: Progress, diff: Difficulty, day: number, r: DayResult): Progress {
  if (p.guess[diff][String(day)]) return p;
  return { ...p, guess: { ...p.guess, [diff]: { ...p.guess[diff], [String(day)]: r } } };
}

export function recordTypology(p: Progress, id: string, r: TypoResult): Progress {
  if (p.typology[id]) return p;
  return { ...p, typology: { ...p.typology, [id]: r } };
}

export function recordDuel(p: Progress, id: string, at: number): Progress {
  if (p.duels[id]) return p;
  return { ...p, duels: { ...p.duels, [id]: at } };
}

// ------------------------------------------------------------------ stats

export interface PlayerStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  lastDay: number | null;
  lastWonDay: number | null;
  /** distribution[k] = wins using k+1 attempts */
  distribution: number[];
}

/** Daily statistics derived from the history. A streak counts consecutive days won. */
export function statsFromHistory(history: Record<string, DayResult>): PlayerStats {
  const days = Object.keys(history).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const s: PlayerStats = {
    played: 0, won: 0, currentStreak: 0, maxStreak: 0, lastDay: null, lastWonDay: null,
    distribution: Array(MAX_ATTEMPTS).fill(0),
  };
  let streak = 0;
  let prevWon: number | null = null;
  for (const day of days) {
    const r = history[String(day)];
    s.played++;
    s.lastDay = day;
    if (r.won) {
      s.won++;
      streak = prevWon === day - 1 ? streak + 1 : 1;
      prevWon = day;
      s.lastWonDay = day;
      s.maxStreak = Math.max(s.maxStreak, streak);
      s.distribution[Math.min(Math.max(r.attempts, 1), MAX_ATTEMPTS) - 1]++;
    } else {
      streak = 0;
      prevWon = null;
    }
  }
  s.currentStreak = streak;
  return s;
}

/** The streak shown today: broken if yesterday's puzzle was not won. */
export function visibleStreak(stats: PlayerStats, today: number): number {
  if (stats.lastWonDay == null) return 0;
  return stats.lastWonDay >= today - 1 ? stats.currentStreak : 0;
}

export interface TypologyStats {
  played: number;
  best: number;
  average: number;
  /** distribution[k] = series with score k */
  distribution: number[];
}

export function typologyStats(p: Progress, filter: (r: TypoResult) => boolean = () => true, total = 10): TypologyStats {
  const rs = Object.values(p.typology).filter((r) => r.total === total && filter(r));
  const distribution = Array(total + 1).fill(0);
  for (const r of rs) distribution[Math.min(Math.max(r.score, 0), total)]++;
  return {
    played: rs.length,
    best: rs.reduce((m, r) => Math.max(m, r.score), 0),
    average: rs.length ? rs.reduce((n, r) => n + r.score, 0) / rs.length : 0,
    distribution,
  };
}
