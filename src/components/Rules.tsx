import { useApp } from '../app-context';
import { evaluateGuess, HINT_COST, MAX_ATTEMPTS, TIER_EMOJI, tier } from '../lib/game';
import { GameTree, TierLegend } from './GameTree';

/** A real example game, computed live from the data. */
const EXAMPLE_TARGET = 'poli1260'; // Polish
const EXAMPLE_GUESSES = ['swah1253', 'nucl1643', 'hind1269', 'stan1295', 'russ1263', 'czec1258', 'poli1260'];

export function Rules() {
  const { core, name } = useApp();
  const guesses = EXAMPLE_GUESSES.filter((g) => g in core.languages);
  const ok = EXAMPLE_TARGET in core.languages;
  const results = ok ? guesses.map((g) => evaluateGuess(core, g, EXAMPLE_TARGET)) : [];
  const emoji = ok ? results.map((r) => TIER_EMOJI[tier(core, r, EXAMPLE_TARGET)]).join('') : '';
  const n = (id: string) => name(id);

  const steps = [
        `${n('swah1253')}: only the root is shared — different macroareas (Africa vs Eurasia), no relationship.`,
        `${n('nucl1643')}: same macroarea, Eurasia, but no kinship — that is why the node is dashed.`,
        `${n('hind1269')}: the paths meet inside Indo-European (at Classical Indo-European) — the mystery language is Indo-European!`,
        `${n('stan1295')}: Indo-European again, but via Germanic — so it is not Germanic.`,
        `${n('russ1263')}: they meet at Slavic — Slavic, but not East Slavic.`,
        `${n('czec1258')}: West Slavic — almost there.`,
        `${n('poli1260')}: found in 7 attempts.`,
      ];

  return (
    <article class="prose">
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

      {ok && (
        <section class="example">
          <h2>An example game</h2>
          <ol class="example-steps">
            {steps.slice(0, results.length).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div class="panel tree-panel">
            <GameTree target={EXAMPLE_TARGET} results={results} status="won" />
            <TierLegend />
          </div>
          <p>The shareable result (no spoilers):</p>
          <pre class="share-preview">{`🌳 LangBang #12 · Normal · 7/20\n${emoji}`}</pre>
        </section>
      )}

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
    </article>
  );
}
