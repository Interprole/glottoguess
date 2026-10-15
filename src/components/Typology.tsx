import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp } from '../app-context';
import { grambankFeatureUrl, loadFeatures, loadGrambank } from '../lib/data';
import { explanation, questionText, valueLabel } from '../lib/featureText';
import { fmt } from '../lib/i18n';
import { mulberry32 } from '../lib/random';
import { readJSON, writeJSON } from '../lib/storage';
import { topNode } from '../lib/tree';
import { generateQuestion, type Question, type QuestionContext, type TypologyDifficulty } from '../lib/typology';
import type { Feature, GrambankData } from '../lib/types';

const SERIES = 10;
const DOMAINS = ['nominal domain', 'verbal domain', 'clause', 'pronoun', 'numeral'];

type Phase = 'setup' | 'question' | 'done';

export function Typology() {
  const { core, t } = useApp();
  const [data, setData] = useState<{ gb: GrambankData; features: Feature[] } | null>(null);
  const [error, setError] = useState(false);
  const [diff, setDiff] = useState<TypologyDifficulty>(() => readJSON('lb-typo-diff', 'easy'));
  const [domain, setDomain] = useState<string>(() => readJSON('lb-typo-domain', ''));
  const [phase, setPhase] = useState<Phase>('setup');
  const [q, setQ] = useState<Question | null>(null);
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([loadGrambank(), loadFeatures()])
      .then(([gb, features]) => setData({ gb, features }))
      .catch(() => setError(true));
  }, []);

  const ctx: QuestionContext | null = useMemo(() => (data ? { core, gb: data.gb, features: data.features } : null), [core, data]);
  const bestKey = `lb-typo-best-${diff}-${domain || 'all'}`;

  const next = (askedSoFar: Set<string>) => {
    if (!ctx) return;
    const rng = mulberry32((Math.random() * 2 ** 32) >>> 0);
    const question = generateQuestion(ctx, diff, rng, { domain: domain || undefined, avoid: askedSoFar });
    setChosen(null);
    if (!question) {
      setFailed(true);
      setPhase('setup');
      return;
    }
    setFailed(false);
    setQ(question);
    setAsked(new Set([...askedSoFar, question.feature.id]));
  };

  const start = () => {
    writeJSON('lb-typo-diff', diff);
    writeJSON('lb-typo-domain', domain);
    setN(1);
    setScore(0);
    setPhase('question');
    next(new Set());
  };

  const answer = (gc: string) => {
    if (chosen || !q) return;
    setChosen(gc);
    if (gc === q.answer) setScore((s) => s + 1);
  };

  const advance = () => {
    if (n >= SERIES) {
      const best = readJSON<number>(bestKey, 0);
      if (score > best) writeJSON(bestKey, score);
      setPhase('done');
      return;
    }
    setN(n + 1);
    next(asked);
  };

  if (error) return <p class="notice">{t.loadError}</p>;

  return (
    <section class="typology">
      <header class="typo-head">
        <h1>{t.typologyTitle}</h1>
        {phase === 'question' && (
          <div class="typo-progress">
            <span>{fmt(t.questionN, { n, total: SERIES })}</span>
            <span class="typo-score">
              {t.score}: <b>{score}</b>
            </span>
          </div>
        )}
      </header>
      {phase === 'question' && (
        <div class="progress-bar" aria-hidden="true">
          <span style={{ width: `${((n - (chosen ? 0 : 1)) / SERIES) * 100}%` }} />
        </div>
      )}

      {phase === 'setup' && (
        <div class="panel typo-setup">
          <p class="lede">{t.typologyIntro}</p>
          <div class="choice-cards">
            {(['easy', 'hard'] as const).map((d) => (
              <button key={d} class={`choice${diff === d ? ' on' : ''}`} onClick={() => setDiff(d)} aria-pressed={diff === d}>
                <b>{d === 'easy' ? t.easy : t.hardTypo}</b>
                <span>{d === 'easy' ? t.easyDesc : t.hardDesc}</span>
              </button>
            ))}
          </div>
          <label class="field">
            <span>{t.topic}</span>
            <select value={domain} onChange={(e) => setDomain((e.target as HTMLSelectElement).value)}>
              <option value="">{t.allTopics}</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {t.domains[d] ?? d}
                </option>
              ))}
            </select>
          </label>
          {failed && <p class="notice">{t.noQuestion}</p>}
          <div class="row">
            <button class="btn primary big" onClick={start} disabled={!ctx}>
              {ctx ? t.start : '…'}
            </button>
            <span class="muted">{fmt(t.best, { n: readJSON<number>(bestKey, 0), total: SERIES })}</span>
          </div>
        </div>
      )}

      {phase === 'question' && q && data && <QuestionView q={q} gb={data.gb} chosen={chosen} onAnswer={answer} onNext={advance} last={n >= SERIES} />}

      {phase === 'done' && (
        <div class="panel typo-done">
          <p class="big-score">
            {score}
            <small>/{SERIES}</small>
          </p>
          <p>{fmt(t.seriesDone, { n: score, total: SERIES })}</p>
          <p class="muted">{fmt(t.best, { n: readJSON<number>(bestKey, 0), total: SERIES })}</p>
          <div class="row">
            <button class="btn primary" onClick={start}>
              {t.playAgain}
            </button>
            <button class="btn" onClick={() => setPhase('setup')}>
              {t.topic}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function QuestionView({ q, gb, chosen, onAnswer, onNext, last }: {
  q: Question;
  gb: GrambankData;
  chosen: string | null;
  onAnswer: (gc: string) => void;
  onNext: () => void;
  last: boolean;
}) {
  const { core, t, name, openCard } = useApp();
  const f = q.feature;
  const text = questionText(f, q.value, t);
  return (
    <div class="panel question">
      <p class="q-domain">{t.domains[f.domain] ?? f.domain}</p>
      <h2 class="q-text">{text}</h2>
      <div class="options">
        {q.options.map((gc) => {
          const v = gb.values[gc][q.featureIndex];
          const state = !chosen ? '' : gc === q.answer ? ' correct' : gc === chosen ? ' wrong' : ' dim';
          const top = topNode(core, gc);
          const area = core.languages[gc][2];
          return (
            <div key={gc} class={`option${state}`}>
              <button class="option-btn" onClick={() => onAnswer(gc)} disabled={!!chosen}>
                <span class="opt-name">{name(gc)}</span>
                <span class="opt-meta">
                  {top === gc ? t.cardIsolate : name(top)}
                  {area ? ` · ${t.areas[area] ?? area}` : ''}
                </span>
                {chosen && <span class="opt-value">{valueLabel(f, v, t)}</span>}
              </button>
              {chosen && (
                <button class="opt-card" onClick={() => openCard(gc)} title={t.openCard} aria-label={`${t.openCard}: ${name(gc)}`}>
                  i
                </button>
              )}
            </div>
          );
        })}
      </div>
      {chosen && (
        <div class={`feedback ${chosen === q.answer ? 'ok' : 'bad'}`}>
          <p class="verdict">{chosen === q.answer ? t.correctAns : t.wrongAns}</p>
          <h3>{t.explanation}</h3>
          <p>{explanation(f)}</p>
          <p class="orig">
            <span class="label">{t.originalWording}:</span> <em>{f.name}</em>
          </p>
          <p>
            <a href={grambankFeatureUrl(f.id)} target="_blank" rel="noopener">
              {fmt(t.grambankLink, { id: f.id })} →
            </a>
          </p>
          <button class="btn primary" onClick={onNext} autoFocus>
            {last ? t.finish : t.next}
          </button>
        </div>
      )}
    </div>
  );
}
