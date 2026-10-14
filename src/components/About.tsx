import type { Strings } from '../lib/i18n';
import type { Lang, MetaData } from '../lib/types';

export function About({ meta, lang }: { meta: MetaData | null; t: Strings; lang: Lang }) {
  const ds = meta?.datasets;
  const s = meta?.stats;
  const ru = lang === 'ru';
  return (
    <article class="prose">
      <h1>{ru ? 'О проекте' : 'About'}</h1>
      <p>
        {ru
          ? 'LangBang — две небольшие игры о языках мира, целиком построенные на открытых лингвистических данных. Генеалогическая загадка использует классификацию Glottolog, типологический квиз — признаки Grambank. Сайт статический: никакого сервера, ваши результаты хранятся только в вашем браузере (localStorage).'
          : 'LangBang is a pair of small games about the world’s languages, built entirely on open linguistic data. The genealogical puzzle uses the Glottolog classification, the typology quiz uses Grambank features. The site is static: there is no server, and your results stay in your browser (localStorage).'}
      </p>

      <h2>{ru ? 'Данные и как их цитировать' : 'Data and how to cite them'}</h2>
      {!ds ? (
        <p>…</p>
      ) : (
        <ul class="citations">
          {(['glottolog', 'grambank', 'wals'] as const).map((k) => (
            <li key={k}>
              <h3>
                <a href={ds[k].url} target="_blank" rel="noopener">
                  {ds[k].title}
                </a>
              </h3>
              <blockquote>{ds[k].citation}</blockquote>
              <p class="muted">
                {ru ? 'Версия' : 'Version'}: CLDF{' '}
                <a href={`https://github.com/${ds[k].repo}/releases/tag/${ds[k].tag}`} target="_blank" rel="noopener">
                  {ds[k].repo}@{ds[k].tag}
                </a>{' '}
                · {ru ? 'лицензия' : 'license'}{' '}
                <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">
                  {ds[k].license}
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p>
        {ru
          ? 'Все три набора данных распространяются по лицензии Creative Commons Attribution 4.0. Данные LangBang — производные: они сокращены и преобразованы скриптом scripts/build_data.py, исходники которого открыты. Формулировки признаков Grambank на английском и русском переписаны для этой игры и не являются официальными; оригинальные формулировки показаны рядом.'
          : 'All three datasets are licensed under Creative Commons Attribution 4.0. LangBang’s data are derived: reduced and transformed by the open-source script scripts/build_data.py. The plain-language English and Russian wordings of Grambank features were written for this game and are not official; the original wording is always shown alongside.'}
      </p>
      <p class="muted">
        {ru
          ? 'Названия языков: Glottolog (включая альтернативные названия из разных каталогов и русские названия из Википедии/Lexvo, поставляемые в составе Glottolog). Карта: Natural Earth (общественное достояние) через пакет world-atlas.'
          : 'Language names: Glottolog (including alternative names from various catalogues and Wikipedia/Lexvo names shipped with Glottolog). Map: Natural Earth (public domain) via the world-atlas package.'}
      </p>

      <h2>{ru ? 'Как это устроено' : 'How it works'}</h2>
      <ul>
        <li>
          {ru
            ? 'Дерево игры: корень → макроареал → семья Glottolog → … → язык. Семья помещается в макроареал, к которому относится большинство её языков; изоляты и языки псевдосемей (жестовые, пиджины и т. п.) — прямо в свой макроареал. Ареальный уровень — не родство.'
            : 'Game tree: root → macroarea → Glottolog family → … → language. A family is placed in the macroarea where most of its languages are; isolates and members of pseudo-families (sign languages, pidgins, …) hang directly under their own macroarea. The area level is not kinship.'}
        </li>
        <li>
          {ru
            ? 'Ежедневный язык выбирается детерминированно: пул сортируется и перемешивается генератором псевдослучайных чисел с фиксированным зерном; день n берёт n-й элемент. В пределах цикла (длина = размер пула) языки не повторяются.'
            : 'The daily language is chosen deterministically: the pool is sorted and shuffled with a fixed-seed PRNG; day n takes item n. Within a cycle (as long as the pool) nothing repeats.'}
        </li>
        <li>
          {ru
            ? 'Сходство языков в квизе: доля совпадающих значений по признакам Grambank, известным у обоих языков (не менее 50); «?» и пропуски не считаются.'
            : 'Language similarity in the quiz: share of matching values over Grambank features known for both languages (at least 50); “?” and missing values are ignored.'}
        </li>
      </ul>
      {s && (
        <>
          <h2>{ru ? 'В цифрах' : 'In numbers'}</h2>
          <dl class="numbers">
            <div><dt>{ru ? 'Языков для догадок' : 'Guessable languages'}</dt><dd>{s.languages_total?.toLocaleString()}</dd></div>
            <div><dt>{ru ? 'Пул «Обычный»' : 'Normal pool'}</dt><dd>{s.pool_normal?.toLocaleString()}</dd></div>
            <div><dt>{ru ? 'Пул «Хардкор»' : 'Hardcore pool'}</dt><dd>{s.pool_hard?.toLocaleString()}</dd></div>
            <div><dt>{ru ? 'Макс. глубина дерева' : 'Max tree depth'}</dt><dd>{s.tree_depth_max}</dd></div>
            <div><dt>{ru ? 'Языков в Grambank' : 'Grambank languages'}</dt><dd>{s.grambank_languages?.toLocaleString()}</dd></div>
            <div><dt>{ru ? 'Признаков Grambank' : 'Grambank features'}</dt><dd>{s.grambank_features}</dd></div>
            <div><dt>{ru ? 'Ссылок на литературу' : 'Literature references'}</dt><dd>{s.references?.toLocaleString()}</dd></div>
          </dl>
        </>
      )}

      <h2>{ru ? 'Код' : 'Code'}</h2>
      <p>
        <a href="https://github.com/Interprole/langbang" target="_blank" rel="noopener">
          github.com/Interprole/langbang
        </a>{' '}
        — {ru ? 'Vite + TypeScript + Preact, конвейер данных на Python.' : 'Vite + TypeScript + Preact, Python data pipeline.'}
      </p>
    </article>
  );
}
