import type { MetaData } from '../lib/types';

export function About({ meta }: { meta: MetaData | null }) {
  const ds = meta?.datasets;
  const s = meta?.stats;
  return (
    <article class="prose">
      <h1>About</h1>
      <p>
        GlottoGuess is a pair of small games about the world’s languages, built entirely on open linguistic data. The genealogical puzzle uses the Glottolog classification, the typology quiz uses Grambank features. The site is static (GitHub Pages). Your results are kept in your browser; if you sign in with Google, they are also stored in a Firebase database so that they follow you across devices and can be used in duels. Only your name, Google profile picture and game results are stored.
      </p>

      <h2>Data and how to cite them</h2>
      {!ds ? (
        <p>…</p>
      ) : (
        <ul class="citations">
          {(['glottolog', 'grambank', 'wals', 'linguameta'] as const).map((k) => (
            <li key={k}>
              <h3>
                <a href={ds[k].url} target="_blank" rel="noopener">
                  {ds[k].title}
                </a>
              </h3>
              <blockquote>{ds[k].citation}</blockquote>
              <p class="muted">
                Version: {k === 'linguameta' ? 'commit' : 'CLDF'}{' '}
                <a href={ds[k].ref_url ?? `https://github.com/${ds[k].repo}/releases/tag/${ds[k].tag}`} target="_blank" rel="noopener">
                  {ds[k].repo}@{ds[k].tag}
                </a>{' '}
                · license{' '}
                <a href={k === 'linguameta' ? 'https://creativecommons.org/licenses/by-sa/4.0/' : 'https://creativecommons.org/licenses/by/4.0/'} target="_blank" rel="noopener">
                  {ds[k].license}
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p>
        Glottolog, Grambank and WALS are licensed under Creative Commons Attribution 4.0; LinguaMeta (speaker numbers) under CC BY-SA 4.0. GlottoGuess’s data are derived: reduced and transformed by the open-source script scripts/build_data.py. The plain-language wordings of Grambank features were written for this game and are not official; the original wording is always shown alongside.
      </p>
      <p class="muted">
        Language names: Glottolog (including alternative names from various catalogues and Wikipedia/Lexvo names shipped with Glottolog). Map: Natural Earth (public domain) via the world-atlas package.
      </p>

      <h2>How it works</h2>
      <ul>
        <li>
          Game tree: root → macroarea → Glottolog family → … → language. A family is placed in the macroarea where most of its languages are; isolates and members of pseudo-families (sign languages, pidgins, …) hang directly under their own macroarea. The area level is not kinship.
        </li>
        <li>
          The daily language is chosen deterministically: the pool is sorted and shuffled with a fixed-seed PRNG; day n takes item n. Within a cycle (as long as the pool) nothing repeats.
        </li>
        <li>
          Language similarity in the quiz: share of matching values over Grambank features known for both languages (at least 50); “?” and missing values are ignored.
        </li>
      </ul>
      {s && (
        <>
          <h2>In numbers</h2>
          <dl class="numbers">
            <div><dt>Guessable languages</dt><dd>{s.languages_total?.toLocaleString()}</dd></div>
            <div><dt>Normal pool</dt><dd>{s.pool_normal?.toLocaleString()}</dd></div>
            <div><dt>Hardcore pool</dt><dd>{s.pool_hard?.toLocaleString()}</dd></div>
            <div><dt>Max tree depth</dt><dd>{s.tree_depth_max}</dd></div>
            <div><dt>Grambank languages</dt><dd>{s.grambank_languages?.toLocaleString()}</dd></div>
            <div><dt>Grambank features</dt><dd>{s.grambank_features}</dd></div>
            <div><dt>Literature references</dt><dd>{s.references?.toLocaleString()}</dd></div>
          </dl>
        </>
      )}

      <h2>Author</h2>
      <p>GlottoGuess is made by <strong>Gleb Bubnov</strong>.</p>

      <h2>Code</h2>
      <p>
        <a href="https://github.com/Interprole/glottoguess" target="_blank" rel="noopener">
          github.com/Interprole/glottoguess
        </a>{' '}
        — Vite + TypeScript + Preact, Python data pipeline.
      </p>
    </article>
  );
}
