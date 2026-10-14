import { describe, expect, it } from 'vitest';
import { normalize, SearchIndex } from './search';

describe('search', () => {
  it('normalizes diacritics, case, apostrophes and ё', () => {
    expect(normalize('Kʼicheʼ')).toBe('kiche');
    expect(normalize('Ainu (China)')).toBe('ainu china');
    expect(normalize('Ёжик')).toBe('ежик');
    expect(normalize('Français')).toBe('francais');
  });
  it('ranks exact > prefix > word prefix > substring, primary names first', () => {
    const ix = new SearchIndex();
    ix.add('a', 'Tok Pisin', 0);
    ix.add('b', 'Pisin', 2);
    ix.add('c', 'Pisinese', 0);
    ix.add('d', 'Kapisini', 0);
    const hits = ix.search('pisin');
    expect(hits.map((h) => h.id)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('returns one hit per language and supports exclusion', () => {
    const ix = new SearchIndex();
    ix.add('r', 'Russian', 0);
    ix.add('r', 'Russki', 2);
    ix.add('r', 'Русский', 1);
    expect(ix.search('russ')).toHaveLength(1);
    expect(ix.search('рус')[0].name).toBe('Русский');
    expect(ix.search('russ', 8, new Set(['r']))).toHaveLength(0);
  });
});
