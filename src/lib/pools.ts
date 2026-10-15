import { FLAG_HARD, FLAG_NORMAL, type CoreData, type Difficulty } from './types';

/** Puzzle pools (sorted glottocodes) for each difficulty. */
export function pools(core: CoreData): Record<Difficulty, string[]> {
  const normal: string[] = [];
  const hard: string[] = [];
  for (const [id, row] of Object.entries(core.languages)) {
    if (row[9] & FLAG_HARD) hard.push(id);
    if (row[9] & FLAG_NORMAL) normal.push(id);
  }
  return { normal: normal.sort(), hard: hard.sort() };
}
