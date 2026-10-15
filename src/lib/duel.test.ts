import { describe, expect, it } from 'vitest';
import { decodeTarget, encodeTarget, newDuelId, rankResults, type DuelResult } from './duel';
import { mulberry32 } from './random';

const R = (uid: string, score: number, extra: Partial<DuelResult> = {}): DuelResult =>
  ({ uid, name: uid, score, total: 20, finishedAt: 0, ...extra });

describe('duels', () => {
  it('obfuscates targets reversibly', () => {
    expect(encodeTarget('russ1263')).not.toContain('russ');
    expect(decodeTarget(encodeTarget('russ1263'))).toBe('russ1263');
    expect(decodeTarget('%%%')).toBe('');
  });
  it('ranks guess duels: winners first, then fewer attempts, then earlier', () => {
    const order = rankResults('guess', [
      R('lost', 20, { won: false }),
      R('slow', 9, { won: true, finishedAt: 1 }),
      R('fast', 4, { won: true, finishedAt: 5 }),
      R('tie', 9, { won: true, finishedAt: 0 }),
      R('quit', 3, { won: false, gaveUp: true }),
    ]).map((r) => r.uid);
    expect(order.slice(0, 3)).toEqual(['fast', 'tie', 'slow']);
    expect(order.slice(3).sort()).toEqual(['lost', 'quit']);
  });
  it('ranks typology duels by score', () => {
    const order = rankResults('typology', [R('a', 6), R('b', 9), R('c', 9, { finishedAt: -1 })]).map((r) => r.uid);
    expect(order).toEqual(['c', 'b', 'a']);
  });
  it('makes url-safe ids', () => {
    const id = newDuelId(mulberry32(1));
    expect(id).toMatch(/^[a-z2-9]{10}$/);
    expect(newDuelId(mulberry32(2))).not.toBe(id);
  });
});
