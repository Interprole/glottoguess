/** Diacritic-, case- and punctuation-insensitive name search for autocomplete. */

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[‘’ʼʻ'`´"“”]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface SearchEntry {
  id: string;
  /** the displayed name that matched */
  name: string;
  norm: string;
  /** 0: primary name, 1: localized primary name, 2: alternative name */
  kind: 0 | 1 | 2;
}

export interface SearchHit {
  id: string;
  name: string;
  kind: 0 | 1 | 2;
  score: number;
}

export class SearchIndex {
  private entries: SearchEntry[] = [];

  add(id: string, name: string, kind: 0 | 1 | 2): void {
    const norm = normalize(name);
    if (norm) this.entries.push({ id, name, norm, kind });
  }

  get size(): number {
    return this.entries.length;
  }

  /**
   * Ranking: exact match > prefix > word prefix > substring; primary names
   * before alternative names; shorter names first. One hit per language.
   */
  search(query: string, limit = 8, exclude?: Set<string>): SearchHit[] {
    const q = normalize(query);
    if (!q) return [];
    const best = new Map<string, SearchHit>();
    for (const e of this.entries) {
      if (exclude?.has(e.id)) continue;
      let base: number;
      if (e.norm === q) base = 0;
      else if (e.norm.startsWith(q)) base = 1;
      else if (e.norm.includes(' ' + q)) base = 2;
      else if (q.length >= 3 && e.norm.includes(q)) base = 3;
      else continue;
      const score = base * 10 + e.kind * 3 + Math.min(e.norm.length, 60) / 100;
      const prev = best.get(e.id);
      if (!prev || score < prev.score) best.set(e.id, { id: e.id, name: e.name, kind: e.kind, score });
    }
    return [...best.values()].sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).slice(0, limit);
  }
}
