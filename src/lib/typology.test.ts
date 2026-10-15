import { describe, expect, it } from 'vitest';
import { core, features, gb } from './__fixtures__/core';
import { mulberry32 } from './random';
import { topNode } from './tree';
import { askableValues, easyDistractors, generateQuestion, hardDistractors, isKnown, similarity } from './typology';

const ctx = { core, gb, features };
const langs = Object.keys(gb.values).sort();

describe('similarity', () => {
  it('compares only features known in both languages', () => {
    expect(similarity('1100?-', '10?0-1', -1, 3)).toBeCloseTo(2 / 3);
    expect(similarity('1100?-', '10?0-1', -1, 4)).toBeNull();
    expect(similarity('1100?-', '10?0-1', 1, 2)).toBe(1);
    expect(similarity('????', '0000', -1, 1)).toBeNull();
  });
});

describe('question generation', () => {
  it('never treats unknown values as absent', () => {
    // F0: engl=1 germ1=1 swed=1 russ=0 ukra=0 poli=0 basq=? swah=0 zulu=0
    expect(askableValues(gb, 0, langs)).toEqual(['0', '1']);
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed);
      const q = generateQuestion(ctx, seed % 2 ? 'hard' : 'easy', rng);
      if (!q) continue;
      const vals = q.options.map((gc) => gb.values[gc][q.featureIndex]);
      expect(vals.every(isKnown)).toBe(true);
      expect(vals.filter((v) => v === q.value)).toHaveLength(1);
      expect(gb.values[q.answer][q.featureIndex]).toBe(q.value);
      expect(new Set(q.options).size).toBe(4);
    }
  });

  it('easy distractors come from different families and macroareas', () => {
    for (let seed = 0; seed < 50; seed++) {
      // English has F0 = 1; languages with F0 = 0 come from Indo-European, Bantu, Japonic, Quechuan, Athabaskan
      const d = easyDistractors(ctx, 'engl', 0, langs, mulberry32(seed));
      expect(d).not.toBeNull();
      const fams = [topNode(core, 'engl'), ...d!.map((gc) => topNode(core, gc))];
      expect(new Set(fams).size).toBe(4);
      const areas = ['engl', ...d!].map((gc) => core.languages[gc][2]);
      expect(new Set(areas).size).toBe(4);
      for (const gc of d!) expect(gb.values[gc][0]).toBe('0');
    }
  });

  it('easy distractors relax the area constraint only when needed', () => {
    // Russian (F0 = 0): only Indo-European languages have F0 = 1 -> impossible
    expect(easyDistractors(ctx, 'russ', 0, langs, mulberry32(1))).toBeNull();
  });

  it('hard distractors are the most similar languages with a different value', () => {
    // asking F0 with answer = russ (0): candidates with known value 1 are engl, germ1, swed
    const d = hardDistractors(ctx, 'russ', 0, langs, mulberry32(1));
    expect(new Set(d)).toEqual(new Set(['engl', 'germ1', 'swed']));
    // with a top-2 cutoff on a larger candidate set, the closest profiles win
    const d2 = hardDistractors(ctx, 'engl', 0, langs, mulberry32(3), 3)!;
    for (const gc of d2) expect(gb.values[gc][0]).not.toBe('1');
    // germ1/engl share the '01' filler; swah/zulu ('0…') are less similar to engl than ukra/russ
    const sims = langs
      .filter((gc) => gc !== 'engl' && isKnown(gb.values[gc][0]) && gb.values[gc][0] !== '1')
      .map((gc) => [gc, similarity(gb.values.engl, gb.values[gc], 0)] as const)
      .filter(([, s]) => s != null)
      .sort((a, b) => b[1]! - a[1]!)
      .slice(0, 3)
      .map(([gc]) => gc);
    expect(new Set(d2)).toEqual(new Set(sims));
  });

  it('respects the domain filter', () => {
    for (let seed = 0; seed < 30; seed++) {
      const q = generateQuestion(ctx, 'easy', mulberry32(seed), { domain: 'clause' });
      if (q) expect(q.feature.id).toBe('F2');
    }
  });
});
