import type { CoreData, Feature, GrambankData, LanguageRow } from '../types';

const L = (name: string, parent: string | null, area: string, lat: number, lon: number, flags = 12): LanguageRow =>
  [name, parent, area, lat, lon, 1, '', '', '', flags];

/**
 * world
 *  ├ area:Eurasia ── indo (Indo-European)
 *  │                  ├ germ ── wger ── engl (English), germ1 (German)
 *  │                  │       └ nger ── swed (Swedish)
 *  │                  └ slav ── east ── russ (Russian), ukra (Ukrainian)
 *  │                          └ west ── poli (Polish)
 *  │               ── basq (Basque, isolate)
 *  └ area:Africa  ── bant ── swah (Swahili), zulu (Zulu)
 */
export const core: CoreData = {
  format: 1,
  areas: ['Africa', 'Eurasia', 'North America', 'South America'],
  families: {
    indo: ['Indo-European', null, 'Eurasia'],
    germ: ['Germanic', 'indo'],
    wger: ['West Germanic', 'germ'],
    nger: ['North Germanic', 'germ'],
    slav: ['Slavic', 'indo'],
    east: ['East Slavic', 'slav'],
    west: ['West Slavic', 'slav'],
    bant: ['Bantu', null, 'Africa'],
    japo: ['Japonic', null, 'Eurasia'],
    quec: ['Quechuan', null, 'South America'],
    atha: ['Athabaskan', null, 'North America'],
  },
  languages: {
    engl: L('English', 'wger', 'Eurasia', 53, -1),
    germ1: L('German', 'wger', 'Eurasia', 51, 10),
    swed: L('Swedish', 'nger', 'Eurasia', 60, 15),
    russ: L('Russian', 'east', 'Eurasia', 59, 50),
    ukra: L('Ukrainian', 'east', 'Eurasia', 49, 31),
    poli: L('Polish', 'west', 'Eurasia', 52, 20),
    basq: ['Basque', null, 'Eurasia', 43, -2, 1, '', '', '', 1],
    swah: L('Swahili', 'bant', 'Africa', -6, 39),
    zulu: L('Zulu', 'bant', 'Africa', -29, 31),
    japa: L('Japanese', 'japo', 'Eurasia', 35, 135),
    quch: L('Quechua', 'quec', 'South America', -13, -72),
    nava: L('Navajo', 'atha', 'North America', 36, -109),
  },
  ru: { russ: 'Русский' },
};

const f = (id: string, domain = 'nominal domain'): Feature => ({
  id, name: `${id}?`, domain, group: '', values: { '0': 'absent', '1': 'present' }, summary: '',
  en: { has: `has ${id}`, lacks: `lacks ${id}` }, ru: null,
});

export const features: Feature[] = [f('F0'), f('F1'), f('F2', 'clause')];

/** 3 features + 60 filler features so that similarity has enough shared data. */
const filler = (seed: string) => seed.repeat(60).slice(0, 60);
export const gb: GrambankData = {
  features: ['F0', 'F1', 'F2', ...Array.from({ length: 60 }, (_, i) => `X${i}`)],
  values: {
    engl: '1?0' + filler('01'),
    germ1: '100' + filler('01'),
    swed: '101' + filler('0110'),
    russ: '011' + filler('10'),
    ukra: '0-1' + filler('10'),
    poli: '011' + filler('1100'),
    basq: '?11' + filler('1'),
    swah: '000' + filler('0'),
    zulu: '0?0' + filler('0001'),
    japa: '010' + filler('0011'),
    quch: '001' + filler('0111'),
    nava: '0-0' + filler('1101'),
  },
};
