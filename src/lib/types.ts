/** Shapes of the JSON files produced by scripts/build_data.py. */

/** [name, parent, area, lat, lon, aes, countries, iso, category, flags] */
export type LanguageRow = [
  string,
  string | null,
  string | null,
  number | null,
  number | null,
  number | null,
  string,
  string,
  string,
  number,
];
/** [name, parent] or, for top-level families, [name, null, area] */
export type FamilyRow = [string, string | null, (string | null)?];

export interface CoreData {
  format: number;
  areas: string[];
  families: Record<string, FamilyRow>;
  languages: Record<string, LanguageRow>;
}

export type NamesData = Record<string, string[]>;

export interface GrambankData {
  features: string[];
  /** one character per feature: '0'..'3', '?' (unknown) or '-' (not coded) */
  values: Record<string, string>;
}

export interface FeatureTexts {
  has?: string;
  lacks?: string;
  values?: Record<string, string>;
}

export interface Feature {
  id: string;
  name: string;
  domain: string;
  group: string;
  values: Record<string, string>;
  summary: string;
  en: FeatureTexts | null;
}

export interface DatasetMeta {
  title: string;
  tag: string;
  repo: string;
  url: string;
  license: string;
  citation: string;
}

export interface MetaData {
  datasets: Record<'glottolog' | 'grambank' | 'wals', DatasetMeta>;
  normal_min_wiki_editions: number;
  min_shared_features: number;
  stats: Record<string, number>;
}

/** [glottolog reference id, formatted citation, document type] */
export type BibEntry = [string, string, string];

export const FLAG_GRAMBANK = 1;
export const FLAG_WALS = 2;
export const FLAG_NORMAL = 4;
export const FLAG_HARD = 8;

export type Difficulty = 'normal' | 'hard';
