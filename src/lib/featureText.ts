import type { Strings } from './i18n';
import type { Feature } from './types';

/** Predicate fragment for a feature value ("has definite articles"), or null if not available. */
export function statement(f: Feature, value: string): string | null {
  const tx = f.en;
  if (!tx) return null;
  if (tx.values) return tx.values[value] ?? null;
  if (value === '1') return tx.has ?? null;
  if (value === '0') return tx.lacks ?? null;
  return null;
}

/** Full question text; falls back to Grambank's original wording. */
export function questionText(f: Feature, value: string, t: Strings): string {
  const s = statement(f, value);
  if (s) return t.whichHas.replace('{q}', s);
  const label = f.values[value] ?? value;
  return `${f.name} → ${label}`;
}

/** Short human label for a value: yes / no / the category label. */
export function valueLabel(f: Feature, value: string | undefined, t: Strings): string {
  if (value === undefined || value === '?' || value === '-') return t.valueUnknown;
  const isBinary = Object.keys(f.values).length === 2 && f.values['0'] === 'absent' && f.values['1'] === 'present';
  if (isBinary) return value === '1' ? t.valueYes : t.valueNo;
  return f.values[value] ?? value;
}

/** Explanation shown after an answer. */
export function explanation(f: Feature): string {
  return f.summary || f.name;
}
