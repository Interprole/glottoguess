import { describe, expect, it } from 'vitest';
import { core } from './__fixtures__/core';
import { lcaIndex, lineage, lowestCommonAncestor, pathTo, topNode } from './tree';

describe('classification paths', () => {
  it('builds lineages from parent links', () => {
    expect(lineage(core, 'engl')).toEqual(['indo', 'germ', 'wger', 'engl']);
    expect(lineage(core, 'basq')).toEqual(['basq']);
  });

  it('puts a macroarea level above families and isolates', () => {
    expect(pathTo(core, 'russ')).toEqual(['_world', '_area:Eurasia', 'indo', 'slav', 'east', 'russ']);
    expect(pathTo(core, 'basq')).toEqual(['_world', '_area:Eurasia', 'basq']);
    expect(pathTo(core, 'swah')).toEqual(['_world', '_area:Africa', 'bant', 'swah']);
  });

  it('computes the lowest common ancestor', () => {
    const p = (id: string) => pathTo(core, id);
    expect(lowestCommonAncestor(p('russ'), p('ukra'))).toBe('east');
    expect(lowestCommonAncestor(p('russ'), p('poli'))).toBe('slav');
    expect(lowestCommonAncestor(p('russ'), p('engl'))).toBe('indo');
    // unrelated but same macroarea: only the (non-genealogical) area is shared
    expect(lowestCommonAncestor(p('russ'), p('basq'))).toBe('_area:Eurasia');
    // different macroareas: only the root
    expect(lowestCommonAncestor(p('russ'), p('swah'))).toBe('_world');
    expect(lowestCommonAncestor(p('russ'), p('russ'))).toBe('russ');
  });

  it('is symmetric', () => {
    const ids = Object.keys(core.languages);
    for (const a of ids) for (const b of ids) {
      const pa = pathTo(core, a), pb = pathTo(core, b);
      expect(pa[lcaIndex(pa, pb)]).toBe(pb[lcaIndex(pb, pa)]);
    }
  });

  it('finds the top-level node', () => {
    expect(topNode(core, 'swed')).toBe('indo');
    expect(topNode(core, 'basq')).toBe('basq');
  });
});
