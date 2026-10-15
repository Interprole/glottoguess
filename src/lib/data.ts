import { SearchIndex } from './search';
import type { BibEntry, CoreData, Feature, GrambankData, MetaData, NamesData } from './types';

declare const __DATA_VERSION__: string;

const BASE = `${import.meta.env.BASE_URL}data/`;
const cache = new Map<string, Promise<unknown>>();

export function loadJSON<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${BASE}${path}?v=${__DATA_VERSION__}`).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export const loadCore = () => loadJSON<CoreData>('core.json');
export const loadNames = () => loadJSON<NamesData>('names.json');
export const loadGrambank = () => loadJSON<GrambankData>('grambank.json');
export const loadFeatures = () => loadJSON<Feature[]>('features.json');
export const loadMeta = () => loadJSON<MetaData>('meta.json');

export async function loadBib(gc: string): Promise<BibEntry[]> {
  try {
    const shard = await loadJSON<Record<string, BibEntry[]>>(`bib/${gc.slice(0, 2)}.json`);
    return shard[gc] ?? [];
  } catch {
    return []; // no references for any language in this shard
  }
}

export function displayName(core: CoreData, id: string): string {
  return core.languages[id]?.[0] ?? core.families[id]?.[0] ?? id;
}

/** Search index over all guessable languages: Glottolog names and alternative names. */
export function buildSearchIndex(core: CoreData, names: NamesData | null): SearchIndex {
  const ix = new SearchIndex();
  for (const [id, row] of Object.entries(core.languages)) ix.add(id, row[0], 0);
  if (names) for (const [id, list] of Object.entries(names)) for (const n of list) ix.add(id, n, 2);
  return ix;
}

export const glottologUrl = (gc: string) => `https://glottolog.org/resource/languoid/id/${gc}`;
export const glottologRefUrl = (id: string) => `https://glottolog.org/resource/reference/id/${id}`;
export const grambankFeatureUrl = (id: string) => `https://grambank.clld.org/parameters/${id}`;
export const grambankLanguageUrl = (gc: string) => `https://grambank.clld.org/languages/${gc}`;
