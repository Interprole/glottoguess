import { describe, expect, it } from 'vitest';
import { core } from './__fixtures__/core';
import {
  applyGuess, applyHint, attemptsLeft, canTakeHint, evaluateGuess, HINT_COST, MAX_ATTEMPTS, newGame, shareText, tier,
} from './game';

const labels = { normal: 'Normal', hard: 'Hardcore', free: 'free play' };

describe('guess evaluation', () => {
  it('reports the lowest common node and the branch on the guess side', () => {
    const r = evaluateGuess(core, 'engl', 'russ');
    expect(r.lcaId).toBe('indo');
    expect(r.branchId).toBe('germ');
    expect(r.correct).toBe(false);
    expect(r.km).toBeGreaterThan(3000);
    expect(r.dir).toBe('NE'); // great-circle bearing from England to Russia
  });
  it('classifies closeness tiers', () => {
    expect(tier(core, evaluateGuess(core, 'swah', 'russ'), 'russ')).toBe('world');
    expect(tier(core, evaluateGuess(core, 'basq', 'russ'), 'russ')).toBe('area');
    expect(tier(core, evaluateGuess(core, 'engl', 'russ'), 'russ')).toBe('family');
    expect(tier(core, evaluateGuess(core, 'poli', 'russ'), 'russ')).toBe('closer');
    expect(tier(core, evaluateGuess(core, 'ukra', 'russ'), 'russ')).toBe('close');
    expect(tier(core, evaluateGuess(core, 'russ', 'russ'), 'russ')).toBe('correct');
  });
});

describe('game state', () => {
  it('wins on the target and ignores duplicates', () => {
    let s = newGame('russ');
    s = applyGuess(s, 'engl');
    s = applyGuess(s, 'engl');
    expect(s.guesses).toEqual(['engl']);
    s = applyGuess(s, 'russ');
    expect(s.status).toBe('won');
    expect(applyGuess(s, 'poli')).toBe(s);
  });
  it('charges hints and loses when attempts run out', () => {
    let s = newGame('russ');
    s = applyHint(s, 'area');
    expect(attemptsLeft(s)).toBe(MAX_ATTEMPTS - HINT_COST);
    expect(canTakeHint(s, 'area')).toBe(false);
    const others = Object.keys(core.languages).filter((x) => x !== 'russ');
    for (let i = 0; i < MAX_ATTEMPTS; i++) s = applyGuess(s, others[i % others.length] + (i >= others.length ? i : ''));
    expect(s.status).toBe('lost');
    expect(s.guesses.length).toBe(MAX_ATTEMPTS - HINT_COST);
  });
  it('shares a spoiler-free result', () => {
    let s = newGame('russ');
    for (const g of ['swah', 'basq', 'engl', 'poli', 'ukra', 'russ']) s = applyGuess(s, g);
    s = { ...s, hints: ['area'] };
    const text = shareText(core, s, { puzzle: 12, difficulty: 'normal', url: 'https://x', labels });
    expect(text).toContain('LangBang #12');
    expect(text).toContain('⬛🟦🟨🟧🟥🟩');
    expect(text).toContain('💡1');
    for (const id of Object.keys(core.languages)) expect(text).not.toContain(core.languages[id][0]);
  });
});
