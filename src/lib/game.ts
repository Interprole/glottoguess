import { ARROWS, bearingDeg, compass, haversineKm, type Compass } from './geo';
import { isArea, lcaIndex, pathTo, WORLD } from './tree';
import type { CoreData, Difficulty } from './types';

/**
 * Maximum number of attempts.
 *
 * Why 20: a puzzle target sits on average ~8.6 nodes below the root of our
 * tree (world > macroarea > ~6.5 genealogical levels, max 26). A player who
 * knows roughly where to look gains about one level every two guesses, so 20
 * leaves room for the deep Atlantic-Congo / Austronesian targets while still
 * making every guess count. Hints cost attempts (see HINT_COST).
 */
export const MAX_ATTEMPTS = 20;
export const HINT_COST = 2;
export type HintKind = 'area' | 'status' | 'country';
export const HINT_KINDS: HintKind[] = ['area', 'status', 'country'];

export interface GuessResult {
  id: string;
  /** index of the lowest common node in the target's path */
  lca: number;
  lcaId: string;
  /** child of the common node on the guess's side (undefined if correct) */
  branchId?: string;
  correct: boolean;
  /** 0 (only the world in common) … 1 (correct) */
  closeness: number;
  km: number | null;
  bearing: number | null;
  dir: Compass | null;
}

export function evaluateGuess(core: CoreData, guess: string, target: string): GuessResult {
  const pg = pathTo(core, guess);
  const pt = pathTo(core, target);
  const i = lcaIndex(pg, pt);
  const correct = guess === target;
  const g = core.languages[guess];
  const t = core.languages[target];
  let km: number | null = null;
  let bearing: number | null = null;
  if (g && t && g[3] != null && g[4] != null && t[3] != null && t[4] != null) {
    km = haversineKm(g[3], g[4], t[3], t[4]);
    bearing = km < 1 ? null : bearingDeg(g[3], g[4], t[3], t[4]);
  }
  return {
    id: guess,
    lca: i,
    lcaId: pt[i],
    branchId: correct ? undefined : pg[i + 1],
    correct,
    closeness: correct ? 1 : i / (pt.length - 1),
    km,
    bearing,
    dir: bearing == null ? null : compass(bearing),
  };
}

/** Coarse closeness class used for colours and the shareable emoji grid. */
export type Tier = 'world' | 'area' | 'family' | 'closer' | 'close' | 'correct';

export function tier(core: CoreData, r: GuessResult, target: string): Tier {
  if (r.correct) return 'correct';
  if (r.lcaId === WORLD) return 'world';
  if (isArea(r.lcaId)) return 'area';
  const pt = pathTo(core, target);
  // share of the genealogical path (top family … target) already in common
  const first = isArea(pt[1]) ? 2 : 1;
  const f = (r.lca - first + 1) / (pt.length - first);
  if (f < 1 / 3) return 'family';
  if (f < 2 / 3) return 'closer';
  return 'close';
}

export const TIER_EMOJI: Record<Tier, string> = {
  world: '⬛',
  area: '🟦',
  family: '🟨',
  closer: '🟧',
  close: '🟥',
  correct: '🟩',
};

export interface GameState {
  target: string;
  guesses: string[];
  hints: HintKind[];
  status: 'playing' | 'won' | 'lost';
}

export function attemptsUsed(s: Pick<GameState, 'guesses' | 'hints'>): number {
  return s.guesses.length + s.hints.length * HINT_COST;
}

export function attemptsLeft(s: Pick<GameState, 'guesses' | 'hints'>): number {
  return Math.max(0, MAX_ATTEMPTS - attemptsUsed(s));
}

export function newGame(target: string): GameState {
  return { target, guesses: [], hints: [], status: 'playing' };
}

/** Pure state transition for a guess. Duplicate guesses are ignored. */
export function applyGuess(s: GameState, guess: string): GameState {
  if (s.status !== 'playing' || s.guesses.includes(guess) || attemptsLeft(s) <= 0) return s;
  const guesses = [...s.guesses, guess];
  const won = guess === s.target;
  const status = won ? 'won' : attemptsLeft({ guesses, hints: s.hints }) <= 0 ? 'lost' : 'playing';
  return { ...s, guesses, status };
}

export function canTakeHint(s: GameState, kind: HintKind): boolean {
  return s.status === 'playing' && !s.hints.includes(kind) && attemptsLeft(s) > HINT_COST;
}

export function applyHint(s: GameState, kind: HintKind): GameState {
  if (!canTakeHint(s, kind)) return s;
  return { ...s, hints: [...s.hints, kind] };
}

/**
 * Wordle-style result without spoilers: only closeness tiers, distances are
 * rounded and no language names are included.
 */
export function shareText(
  core: CoreData,
  s: GameState,
  opts: { puzzle: number | null; difficulty: Difficulty; url: string; labels: { normal: string; hard: string; free: string } },
): string {
  const rows = s.guesses.map((g) => TIER_EMOJI[tier(core, evaluateGuess(core, g, s.target), s.target)]);
  const lines: string[] = [];
  for (let i = 0; i < rows.length; i += 10) lines.push(rows.slice(i, i + 10).join(''));
  const score = s.status === 'won' ? `${attemptsUsed(s)}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
  const hints = s.hints.length ? ` 💡${s.hints.length}` : '';
  const title = opts.puzzle != null ? `LangBang #${opts.puzzle}` : `LangBang (${opts.labels.free})`;
  const diff = opts.difficulty === 'hard' ? opts.labels.hard : opts.labels.normal;
  const last = s.guesses.length ? evaluateGuess(core, s.guesses[s.guesses.length - 1], s.target) : null;
  const tail = s.status !== 'won' && last?.dir ? ` ${ARROWS[last.dir]}` : '';
  return `🌳 ${title} · ${diff} · ${score}${hints}\n${lines.join('\n')}${tail}\n${opts.url}`;
}
