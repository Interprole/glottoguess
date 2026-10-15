// Sanity checks against the real data in public/data (skipped if not built).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dailyAnswer } from './daily';
import { evaluateGuess } from './game';
import { mulberry32 } from './random';
import { pathTo } from './tree';
import { generateQuestion, isKnown } from './typology';
import { FLAG_HARD, FLAG_NORMAL, type CoreData, type Feature, type GrambankData } from './types';

const dir = 'public/data/';
const has = existsSync(dir + 'core.json') && existsSync(dir + 'grambank.json');
const load = <T>(f: string): T => JSON.parse(readFileSync(dir + f, 'utf8')) as T;

describe.skipIf(!has)('real data', () => {
  const core = has ? load<CoreData>('core.json') : (null as unknown as CoreData);
  const gb = has ? load<GrambankData>('grambank.json') : (null as unknown as GrambankData);
  const features = has ? load<Feature[]>('features.json') : [];

  it('has sensible puzzle pools', () => {
    const rows = Object.values(core.languages);
    const normal = rows.filter((r) => r[9] & FLAG_NORMAL).length;
    const hard = rows.filter((r) => r[9] & FLAG_HARD).length;
    expect(normal).toBeGreaterThan(300);
    expect(hard).toBeGreaterThan(5000);
    for (const id of ['stan1295', 'russ1263', 'swah1253', 'nucl1643']) expect(core.languages[id][9] & FLAG_NORMAL).toBeTruthy();
  });

  it('daily targets are genealogical languages and the LCA logic holds', () => {
    const pool = Object.keys(core.languages).filter((id) => core.languages[id][9] & FLAG_NORMAL);
    for (let d = 1; d <= 60; d++) {
      const target = dailyAnswer(pool, d, 'test');
      const p = pathTo(core, target);
      expect(p.length).toBeGreaterThanOrEqual(4); // world, area, family, language
      expect(evaluateGuess(core, target, target).correct).toBe(true);
    }
    expect(evaluateGuess(core, 'stan1295', 'russ1263').lcaId).toBe(pathTo(core, 'russ1263')[3]);
  });

  it('every feature has human-readable texts', () => {
    expect(features).toHaveLength(195);
    for (const f of features) expect(f.en && (f.en.has || f.en.values)).toBeTruthy();
  });

  it('has speaker estimates for most puzzle languages', () => {
    const normal = Object.values(core.languages).filter((r) => r[9] & FLAG_NORMAL);
    const known = normal.filter((r) => r[10] != null).length;
    expect(known / normal.length).toBeGreaterThan(0.8);
    expect(core.languages['russ1263'][10]).toBeGreaterThan(1e8);
  });

  it('generates the same typology series from the same seed (duels)', () => {
    const ctx = { core, gb, features };
    const ids = (seed: number) => {
      const rng = mulberry32(seed);
      const asked = new Set<string>();
      const out: string[] = [];
      for (let i = 0; i < 10; i++) {
        const q = generateQuestion(ctx, 'hard', rng, { avoid: asked })!;
        asked.add(q.feature.id);
        out.push(`${q.feature.id}:${q.options.join(',')}`);
      }
      return out;
    };
    expect(ids(12345)).toEqual(ids(12345));
    expect(ids(12345)).not.toEqual(ids(54321));
    expect(new Set(ids(7).map((x) => x.split(':')[0])).size).toBe(10);
  });

  it('generates valid questions in every topic and difficulty', () => {
    const ctx = { core, gb, features };
    for (const domain of ['', 'nominal domain', 'verbal domain', 'clause', 'pronoun', 'numeral']) {
      for (const diff of ['easy', 'hard'] as const) {
        for (let seed = 0; seed < 6; seed++) {
          const q = generateQuestion(ctx, diff, mulberry32(seed * 31 + domain.length), { domain: domain || undefined });
          expect(q, `${domain}/${diff}`).not.toBeNull();
          const vals = q!.options.map((gc) => gb.values[gc][q!.featureIndex]);
          expect(vals.every(isKnown)).toBe(true);
          expect(vals.filter((v) => v === q!.value)).toHaveLength(1);
          if (domain) expect(q!.feature.domain).toBe(domain);
        }
      }
    }
  });
});
