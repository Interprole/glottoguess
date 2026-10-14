import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../app-context';
import {
  glottologRefUrl, glottologUrl, grambankFeatureUrl, grambankLanguageUrl, loadBib, loadFeatures, loadGrambank, loadNames,
} from '../lib/data';
import { statement } from '../lib/featureText';
import { lineage } from '../lib/tree';
import { FLAG_GRAMBANK, type BibEntry, type Feature, type GrambankData } from '../lib/types';
import { Modal } from './Modal';
import { WorldMap } from './WorldMap';

/** Features shown on a card, in order of preference (well-known typological landmarks). */
const CARD_FEATURES = [
  'GB133', 'GB131', 'GB132', 'GB070', 'GB409', 'GB020', 'GB028', 'GB030', 'GB057', 'GB051', 'GB086',
  'GB074', 'GB075', 'GB044', 'GB415', 'GB323', 'GB335', 'GB118', 'GB263', 'GB167',
];
const MAX_CARD_FEATURES = 7;

export function LanguageCard({ id, onClose }: { id: string; onClose: () => void }) {
  const { core, t, name, lang } = useApp();
  const row = core.languages[id];
  const [alt, setAlt] = useState<string[]>([]);
  const [refs, setRefs] = useState<BibEntry[] | null>(null);
  const [gb, setGb] = useState<{ data: GrambankData; features: Feature[] } | null>(null);
  const inGrambank = !!row && (row[9] & FLAG_GRAMBANK) !== 0;

  useEffect(() => {
    setRefs(null);
    loadNames().then((n) => setAlt(n[id] ?? [])).catch(() => undefined);
    loadBib(id).then(setRefs);
    if (inGrambank) {
      Promise.all([loadGrambank(), loadFeatures()]).then(([data, features]) => setGb({ data, features })).catch(() => undefined);
    }
  }, [id]);

  if (!row) return null;
  const [enName, , area, lat, lon, aes, countries, iso, category] = row;
  const lin = lineage(core, id);
  const isolate = lin.length === 1;

  let regionNames: Intl.DisplayNames | null = null;
  try {
    regionNames = new Intl.DisplayNames([lang], { type: 'region' });
  } catch {
    regionNames = null;
  }
  const countryList = countries ? countries.split(';').map((c) => regionNames?.of(c) ?? c) : [];

  const features: { f: Feature; text: string }[] = [];
  if (gb) {
    const vals = gb.data.values[id];
    const fidx = new Map(gb.data.features.map((f, i) => [f, i]));
    const byId = new Map(gb.features.map((f) => [f.id, f]));
    for (const fid of CARD_FEATURES) {
      if (features.length >= MAX_CARD_FEATURES) break;
      const f = byId.get(fid);
      const i = fidx.get(fid);
      if (!f || i === undefined || !vals) continue;
      const v = vals[i];
      if (v === '?' || v === '-') continue;
      // verb-position features: only list the ones that hold (Grambank allows several)
      if (['GB131', 'GB132', 'GB133'].includes(fid) && v !== '1') continue;
      const text = statement(f, v, lang);
      if (text) features.push({ f, text });
    }
  }

  const title = name(id);
  return (
    <Modal title={title} onClose={onClose} wide>
      <div class="card">
        <div class="card-top">
          <div class="card-ids">
            {lang === 'ru' && title !== enName && <p class="card-en">{enName}</p>}
            <p class="card-codes">
              <span>
                {t.cardGlottocode}:{' '}
                <a class="mono" href={glottologUrl(id)} target="_blank" rel="noopener">
                  {id}
                </a>
              </span>
              {iso && (
                <span>
                  {t.cardIso}: <span class="mono">{iso}</span>
                </span>
              )}
            </p>
            {alt.length > 0 && (
              <p class="card-alt">
                <span class="label">{t.cardAltNames}:</span> {alt.slice(0, 12).join(', ')}
                {alt.length > 12 ? ', …' : ''}
              </p>
            )}
            <dl class="card-facts">
              {category && (
                <>
                  <dt>{t.cardCategory}</dt>
                  <dd>{t.categories[category] ?? category}</dd>
                </>
              )}
              <dt>{t.cardStatus}</dt>
              <dd>
                {aes ? <span class={`aes aes-${aes}`}>{t.aes[aes]}</span> : '—'}
              </dd>
              {area && (
                <>
                  <dt>{t.cardArea}</dt>
                  <dd>{t.areas[area] ?? area}</dd>
                </>
              )}
              {countryList.length > 0 && (
                <>
                  <dt>{t.cardCountries}</dt>
                  <dd>
                    {countryList.slice(0, 8).join(', ')}
                    {countryList.length > 8 ? ` +${countryList.length - 8}` : ''}
                  </dd>
                </>
              )}
            </dl>
          </div>
          <WorldMap lat={lat} lon={lon} label={title} />
        </div>

        <section>
          <h3>{t.cardClassification}</h3>
          {isolate ? (
            <p class="muted">{t.cardIsolate}</p>
          ) : (
            <ol class="lineage">
              {lin.map((n, i) => (
                <li key={n} style={{ '--depth': i } as Record<string, number>}>
                  {n === id ? (
                    <strong>{title}</strong>
                  ) : (
                    <a href={glottologUrl(n)} target="_blank" rel="noopener">
                      {name(n)}
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h3>{t.cardFeatures}</h3>
          {!inGrambank ? (
            <p class="muted">{t.cardNoFeatures}</p>
          ) : !gb ? (
            <p class="muted">…</p>
          ) : (
            <>
              <ul class="card-features">
                {features.map(({ f, text }) => (
                  <li key={f.id}>
                    <span class="feat-text">{text[0].toUpperCase() + text.slice(1)}</span>{' '}
                    <a class="feat-id mono" href={grambankFeatureUrl(f.id)} target="_blank" rel="noopener">
                      {f.id}
                    </a>
                  </li>
                ))}
              </ul>
              <p>
                <a href={grambankLanguageUrl(id)} target="_blank" rel="noopener">
                  {t.cardOnGrambank} →
                </a>
              </p>
            </>
          )}
        </section>

        <section>
          <h3>{t.cardRefs}</h3>
          {refs == null ? (
            <p class="muted">…</p>
          ) : refs.length === 0 ? (
            <p class="muted">{t.cardNoRefs}</p>
          ) : (
            <ul class="refs">
              {refs.map(([rid, text, type]) => (
                <li key={rid}>
                  <a href={glottologRefUrl(rid)} target="_blank" rel="noopener">
                    {text}
                  </a>{' '}
                  <span class="ref-type">{type.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
          )}
          <p>
            <a href={glottologUrl(id)} target="_blank" rel="noopener">
              {t.cardOnGlottolog} →
            </a>
          </p>
        </section>
      </div>
    </Modal>
  );
}
