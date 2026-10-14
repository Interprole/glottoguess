import { useApp } from '../app-context';
import { evaluateGuess, HINT_COST, MAX_ATTEMPTS, TIER_EMOJI, tier } from '../lib/game';
import { GameTree, TierLegend } from './GameTree';

/** A real example game, computed live from the data. */
const EXAMPLE_TARGET = 'poli1260'; // Polish
const EXAMPLE_GUESSES = ['swah1253', 'nucl1643', 'hind1269', 'stan1295', 'russ1263', 'czec1258', 'poli1260'];

export function Rules() {
  const { core, lang, name } = useApp();
  const guesses = EXAMPLE_GUESSES.filter((g) => g in core.languages);
  const ok = EXAMPLE_TARGET in core.languages;
  const results = ok ? guesses.map((g) => evaluateGuess(core, g, EXAMPLE_TARGET)) : [];
  const emoji = ok ? results.map((r) => TIER_EMOJI[tier(core, r, EXAMPLE_TARGET)]).join('') : '';
  const n = (id: string) => name(id);

  const steps =
    lang === 'ru'
      ? [
          `${n('swah1253')}: только корень — языки в разных макроареалах (Африка и Евразия) и не родственны.`,
          `${n('nucl1643')}: общий макроареал «Евразия», но родства нет — поэтому узел пунктирный.`,
          `${n('hind1269')}: встреча в узле «Indo-European» — загаданный язык индоевропейский!`,
          `${n('stan1295')}: снова Indo-European, но через германскую ветвь — значит, не германский.`,
          `${n('russ1263')}: встреча в «Slavic» — славянский язык, но не восточнославянский.`,
          `${n('czec1258')}: «West Slavic» — осталось совсем немного.`,
          `${n('poli1260')}: угадано за 7 попыток.`,
        ]
      : [
          `${n('swah1253')}: only the root is shared — different macroareas (Africa vs Eurasia), no relationship.`,
          `${n('nucl1643')}: same macroarea, Eurasia, but no kinship — that is why the node is dashed.`,
          `${n('hind1269')}: they meet at Indo-European — the mystery language is Indo-European!`,
          `${n('stan1295')}: Indo-European again, but via Germanic — so it is not Germanic.`,
          `${n('russ1263')}: they meet at Slavic — Slavic, but not East Slavic.`,
          `${n('czec1258')}: West Slavic — almost there.`,
          `${n('poli1260')}: found in 7 attempts.`,
        ];

  return (
    <article class="prose">
      {lang === 'ru' ? (
        <>
          <h1>Правила</h1>
          <h2>«Угадай язык»</h2>
          <p>
            Каждый день загадан один язык — одинаковый для всех игроков, новая загадка появляется в 00:00 UTC. Вводите
            названия любых языков (подходят и альтернативные названия из Glottolog). После каждой догадки вы узнаёте{' '}
            <strong>самый нижний общий узел классификации</strong> между вашим языком и загаданным — и постепенно
            спускаетесь по генеалогическому дереву Glottolog.
          </p>
          <ul>
            <li>
              У вас {MAX_ATTEMPTS} попыток. Средний загаданный язык находится примерно в 8–9 узлах от корня (у глубоких
              ветвей атлантическо-конголезских или австронезийских языков — до 26), а знающий игрок спускается примерно на
              уровень за две догадки: 20 попыток хватает, но каждая на счету.
            </li>
            <li>
              Над семьями добавлен уровень <strong>макроареалов</strong> Glottolog (Африка, Евразия, Папунезия, Австралия,
              Северная и Южная Америка). Это <em>не родство</em>, а география — такие узлы нарисованы пунктиром. Без них у
              неродственных языков вообще не было бы общей точки.
            </li>
            <li>Для каждой догадки также показано расстояние до загаданного языка (по координатам Glottolog) и направление.</li>
            <li>
              Подсказки — макроареал, статус угрозы исчезновения по Glottolog, одна из стран — стоят по {HINT_COST}{' '}
              попытки каждая. (Числа носителей в открытых данных Glottolog нет, поэтому вместо него — статус.)
            </li>
            <li>
              <strong>Обычный</strong> уровень: язык входит в 200-языковую выборку WALS либо описан в Grambank/WALS и имеет
              статьи как минимум в 10 разделах Википедии. <strong>Хардкор</strong>: любой язык уровня «language» из
              генеалогической семьи. Изоляты, неклассифицированные, жестовые языки, пиджины и диалекты не загадываются (но
              их можно называть в догадках).
            </li>
            <li>«Свободная игра» загадывает случайный язык и не влияет на статистику.</li>
          </ul>
        </>
      ) : (
        <>
          <h1>Rules</h1>
          <h2>Guess the language</h2>
          <p>
            Every day there is one mystery language — the same for everybody, changing at 00:00 UTC. Type the name of any
            language (alternative names from Glottolog work too). After each guess you learn the{' '}
            <strong>lowest node of the classification shared</strong> by your language and the mystery language, so you
            gradually work your way down the Glottolog family tree.
          </p>
          <ul>
            <li>
              You have {MAX_ATTEMPTS} attempts. An average target sits 8–9 nodes below the root (up to 26 for deep
              Atlantic-Congo or Austronesian branches), and an informed player descends about one level every two guesses:
              20 is enough, but every guess counts.
            </li>
            <li>
              Above the families sits a level of Glottolog <strong>macroareas</strong> (Africa, Eurasia, Papunesia,
              Australia, North and South America). This is <em>geography, not kinship</em> — such nodes are dashed. Without
              it unrelated languages would have nothing in common at all.
            </li>
            <li>Each guess also shows the distance to the mystery language (Glottolog coordinates) and the direction.</li>
            <li>
              Hints — macroarea, Glottolog endangerment status, one country — cost {HINT_COST} attempts each. (Glottolog’s
              open data have no speaker numbers, hence the status.)
            </li>
            <li>
              <strong>Normal</strong>: the language is in the WALS 200-language sample, or it is described in Grambank/WALS
              and has articles in at least 10 Wikipedia editions. <strong>Hardcore</strong>: any language-level languoid in a
              genealogical family. Isolates, unclassified and sign languages, pidgins and dialects are never targets (but you
              can use them as guesses).
            </li>
            <li>Free play picks a random language and does not affect your statistics.</li>
          </ul>
        </>
      )}

      {ok && (
        <section class="example">
          <h2>{lang === 'ru' ? 'Пример партии' : 'An example game'}</h2>
          <ol class="example-steps">
            {steps.slice(0, results.length).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div class="panel tree-panel">
            <GameTree target={EXAMPLE_TARGET} results={results} status="won" />
            <TierLegend />
          </div>
          <p>
            {lang === 'ru' ? 'Результат для шеринга (без спойлера):' : 'The shareable result (no spoilers):'}
          </p>
          <pre class="share-preview">{`🌳 LangBang #12 · ${lang === 'ru' ? 'Обычный' : 'Normal'} · 7/20\n${emoji}`}</pre>
        </section>
      )}

      {lang === 'ru' ? (
        <>
          <h2>«Типология»</h2>
          <p>
            Вопрос — грамматический признак из Grambank, варианты — четыре языка; признак есть (или, для порядковых
            признаков, имеет спрошенное значение) ровно у одного из них. Вопрос задаётся, только если значение признака
            известно у всех четырёх языков: «?» и пропуски никогда не считаются за «нет».
          </p>
          <ul>
            <li>
              <strong>Лёгкий</strong>: известные языки из разных семей и, по возможности, разных макроареалов.
            </li>
            <li>
              <strong>Сложный</strong>: дистракторы — языки с самым похожим профилем Grambank. Сходство считается только по
              признакам, известным у обоих языков (минимум 50 общих признаков, спрошенный признак исключён), с небольшим
              бонусом за ту же семью и ареал. Но по спрошенному признаку они отличаются.
            </li>
            <li>Серия — 10 вопросов; можно выбрать тему (имя, глагол, клауза, местоимения, числительные).</li>
          </ul>
        </>
      ) : (
        <>
          <h2>Typology</h2>
          <p>
            Each question is a grammatical feature from Grambank and four languages; exactly one of them has the feature
            (or, for word-order features, the value asked about). A question is only asked if the value is known for all
            four languages: “?” and missing values are never treated as “no”.
          </p>
          <ul>
            <li>
              <strong>Easy</strong>: well-known languages from different families and, where possible, different macroareas.
            </li>
            <li>
              <strong>Hard</strong>: the distractors are the languages with the most similar overall Grambank profile.
              Similarity only counts features known for both languages (at least 50 of them, the asked feature excluded),
              with a small bonus for the same family and area — yet they differ on the feature asked.
            </li>
            <li>A series has 10 questions; you can pick a topic (nouns, verbs, clauses, pronouns, numerals).</li>
          </ul>
        </>
      )}
    </article>
  );
}
