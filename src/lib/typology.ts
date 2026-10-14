import { pick, sample, shuffle, type Rng } from './random';
import { topNode } from './tree';
import { FLAG_NORMAL, type CoreData, type Feature, type GrambankData } from './types';

/** Mirrors MIN_SHARED_FEATURES in scripts/build_data.py. */
export const MIN_SHARED_FEATURES = 50;

export const isKnown = (v: string | undefined): v is string => v !== undefined && v !== '?' && v !== '-';

/**
 * Agreement over features known in *both* languages ('?' and uncoded values
 * are skipped, never read as "absent"); null if fewer than ``minShared``
 * features can be compared. ``skip`` leaves out the feature being asked.
 */
export function similarity(a: string, b: string, skip = -1, minShared = MIN_SHARED_FEATURES): number | null {
  let shared = 0;
  let agree = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (i === skip) continue;
    const x = a[i];
    const y = b[i];
    if (!isKnown(x) || !isKnown(y)) continue;
    shared++;
    if (x === y) agree++;
  }
  return shared < minShared ? null : agree / shared;
}

export type TypologyDifficulty = 'easy' | 'hard';

export interface Question {
  feature: Feature;
  featureIndex: number;
  /** the value the question asks about */
  value: string;
  /** four glottocodes in display order */
  options: string[];
  answer: string;
}

export interface QuestionContext {
  core: CoreData;
  gb: GrambankData;
  features: Feature[];
}

/** Values of a feature for which a question can be asked: >=1 language with it, >=3 with another known value. */
export function askableValues(gb: GrambankData, i: number, langs: string[]): string[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const gc of langs) {
    const v = gb.values[gc][i];
    if (!isKnown(v)) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
    total++;
  }
  return [...counts.entries()].filter(([, n]) => n >= 1 && total - n >= 3).map(([v]) => v).sort();
}

function areaOf(core: CoreData, gc: string): string | null {
  return core.languages[gc]?.[2] ?? null;
}

/**
 * Easy distractors: languages with a *known, different* value, each from a
 * different top-level family and (when possible) a different macroarea than
 * the answer and each other.
 */
export function easyDistractors(ctx: QuestionContext, answer: string, i: number, pool: string[], rng: Rng): string[] | null {
  const { core, gb } = ctx;
  const value = gb.values[answer][i];
  const cands = shuffle(pool.filter((gc) => gc !== answer && isKnown(gb.values[gc][i]) && gb.values[gc][i] !== value), rng);
  for (const strictArea of [true, false]) {
    const chosen: string[] = [];
    const fams = new Set([topNode(core, answer)]);
    const areas = new Set([areaOf(core, answer)]);
    for (const gc of cands) {
      const fam = topNode(core, gc);
      const area = areaOf(core, gc);
      if (fams.has(fam) || (strictArea && areas.has(area))) continue;
      chosen.push(gc);
      fams.add(fam);
      areas.add(area);
      if (chosen.length === 3) return chosen;
    }
  }
  return null;
}

/**
 * Hard distractors: languages whose overall Grambank profile is most similar
 * to the answer's (agreement on features known for both, at least
 * MIN_SHARED_FEATURES of them, the asked feature excluded), with a bonus for
 * the same family / macroarea, but with a known and *different* value for
 * the asked feature.
 */
export function hardDistractors(ctx: QuestionContext, answer: string, i: number, pool: string[], rng: Rng, top = 10): string[] | null {
  const { core, gb } = ctx;
  const av = gb.values[answer];
  const value = av[i];
  const fam = topNode(core, answer);
  const area = areaOf(core, answer);
  const scored: { gc: string; score: number }[] = [];
  for (const gc of pool) {
    if (gc === answer) continue;
    const v = gb.values[gc][i];
    if (!isKnown(v) || v === value) continue;
    const sim = similarity(av, gb.values[gc], i);
    if (sim == null) continue;
    const bonus = (topNode(core, gc) === fam ? 0.08 : 0) + (areaOf(core, gc) === area ? 0.03 : 0);
    scored.push({ gc, score: sim + bonus });
  }
  if (scored.length < 3) return null;
  scored.sort((a, b) => b.score - a.score || a.gc.localeCompare(b.gc));
  return sample(scored.slice(0, Math.max(top, 3)).map((s) => s.gc), 3, rng);
}

export function featureHasText(f: Feature): boolean {
  return !!(f.en && (f.en.has || f.en.values));
}

/**
 * Generate one question. Easy: well-known languages (the "Normal" puzzle
 * pool) from different families and areas. Hard: any Grambank language,
 * distractors with a similar overall profile. Every option has a *known*
 * value for the feature; exactly one has the asked value.
 */
export function generateQuestion(
  ctx: QuestionContext,
  difficulty: TypologyDifficulty,
  rng: Rng,
  opts: { domain?: string; avoid?: Set<string> } = {},
): Question | null {
  const { core, gb, features } = ctx;
  const all = Object.keys(gb.values).filter((gc) => gc in core.languages).sort();
  const familiar = all.filter((gc) => core.languages[gc][9] & FLAG_NORMAL);
  const pool = difficulty === 'easy' && familiar.length >= 40 ? familiar : all;
  const fidx = new Map(gb.features.map((f, i) => [f, i]));
  const eligible = features.filter(
    (f) => fidx.has(f.id) && (!opts.domain || f.domain === opts.domain) && !opts.avoid?.has(f.id),
  );
  const base = eligible.length ? eligible : features.filter((f) => fidx.has(f.id));
  for (let attempt = 0; attempt < 40; attempt++) {
    const feature = pick(base, rng);
    const i = fidx.get(feature.id)!;
    const values = askableValues(gb, i, pool);
    if (!values.length) continue;
    const value = pick(values, rng);
    const withValue = pool.filter((gc) => gb.values[gc][i] === value);
    const answer = pick(withValue, rng);
    const distractors =
      difficulty === 'easy'
        ? easyDistractors(ctx, answer, i, pool, rng)
        : hardDistractors(ctx, answer, i, pool, rng);
    if (!distractors) continue;
    return { feature, featureIndex: i, value, answer, options: shuffle([answer, ...distractors], rng) };
  }
  return null;
}
