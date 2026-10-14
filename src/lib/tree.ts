import type { CoreData } from './types';

export const WORLD = '_world';
export const AREA_PREFIX = '_area:';

export const isArea = (id: string) => id.startsWith(AREA_PREFIX);
export const areaName = (id: string) => id.slice(AREA_PREFIX.length);
export const isVirtual = (id: string) => id === WORLD || isArea(id);

/** Path from the top-level family down to (and including) the languoid. */
export function lineage(core: CoreData, id: string): string[] {
  const out = [id];
  let parent = core.languages[id]?.[1] ?? core.families[id]?.[1] ?? null;
  const seen = new Set(out);
  while (parent && !seen.has(parent)) {
    out.push(parent);
    seen.add(parent);
    parent = core.families[parent]?.[1] ?? null;
  }
  return out.reverse();
}

/**
 * Path used by the guessing game:
 *   world > macroarea > top-level family > … > language.
 *
 * The macroarea level is *not* genealogical: it only gives unrelated languages
 * (different families, isolates) a meaningful meeting point. A family hangs
 * under its dominant macroarea; isolates and pseudo-family members (sign
 * languages, pidgins, …) hang directly under their own macroarea.
 * Mirrors ``game_path`` in scripts/build_data.py.
 */
export function pathTo(core: CoreData, id: string): string[] {
  const lin = lineage(core, id);
  const top = lin[0];
  const area = top in core.families ? core.families[top][2] : core.languages[id]?.[2];
  return area ? [WORLD, AREA_PREFIX + area, ...lin] : [WORLD, ...lin];
}

/** Index (in both paths) of the lowest common node. Paths share at least the root. */
export function lcaIndex(a: string[], b: string[]): number {
  let i = 0;
  while (i + 1 < a.length && i + 1 < b.length && a[i + 1] === b[i + 1]) i++;
  return i;
}

export function lowestCommonAncestor(a: string[], b: string[]): string {
  return a[lcaIndex(a, b)];
}

/** Top-level family (or the language itself when it stands alone). */
export function topNode(core: CoreData, id: string): string {
  return lineage(core, id)[0];
}

export function nodeName(core: CoreData, id: string): string {
  if (id === WORLD) return 'World';
  if (isArea(id)) return areaName(id);
  return core.languages[id]?.[0] ?? core.families[id]?.[0] ?? id;
}
