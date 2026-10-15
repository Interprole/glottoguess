/** Asynchronous duels: several players play the very same game and compare results. */
import type { Difficulty } from './types';
import type { TypologyDifficulty } from './typology';

export type DuelSpec =
  | { game: 'guess'; difficulty: Difficulty; /** obfuscated target, see encodeTarget */ t: string }
  | { game: 'typology'; difficulty: TypologyDifficulty; domain: string; seed: number };

export interface Duel {
  id: string;
  creatorUid: string;
  creatorName: string;
  createdAt: number;
  spec: DuelSpec;
}

export interface DuelResult {
  uid: string;
  name: string;
  photo?: string;
  /** guess: attempts used (lower is better); typology: correct answers (higher is better) */
  score: number;
  total: number;
  won?: boolean;
  gaveUp?: boolean;
  finishedAt: number;
}

/**
 * Light obfuscation so the answer is not readable at a glance in the duel
 * document (this is a game between friends, not a security boundary).
 */
export function encodeTarget(gc: string): string {
  return btoa(gc.split('').reverse().join(''));
}
export function decodeTarget(s: string): string {
  try {
    return atob(s).split('').reverse().join('');
  } catch {
    return '';
  }
}

/** Leaderboard order: guess — winners first, fewer attempts, earlier; typology — higher score, earlier. */
export function rankResults(game: DuelSpec['game'], rs: DuelResult[]): DuelResult[] {
  return [...rs].sort((a, b) => {
    if (game === 'guess') {
      if (!!a.won !== !!b.won) return a.won ? -1 : 1;
      if (a.won && b.won && a.score !== b.score) return a.score - b.score;
    } else if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.finishedAt - b.finishedAt;
  });
}

/** Random, URL-friendly duel id (also used as the Firestore document id). */
export function newDuelId(rng: () => number = Math.random): string {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += abc[Math.floor(rng() * abc.length)];
  return s;
}
