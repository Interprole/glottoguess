import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApp } from '../app-context';
import { grambankFeatureUrl, loadFeatures, loadGrambank } from '../lib/data';
import { explanation, questionText, valueLabel } from '../lib/featureText';
import { fmt } from '../lib/i18n';
import { recordTypology, typologyStats } from '../lib/progress';
import { mulberry32, type Rng } from '../lib/random';
import { readJSON, writeJSON } from '../lib/storage';
import { updateProgress, useProgress } from '../lib/store';
import { topNode } from '../lib/tree';
import { generateQuestion, type Question, type QuestionContext, type TypologyDifficulty } from '../lib/typology';
import type { Feature, GrambankData } from '../lib/types';
import { ChallengeButton } from './Duels';
import { Modal } from './Modal';

export const SERIES = 10;
export const DOMAINS = ['nominal domain', 'verbal domain', 'clause', 'pronoun', 'numeral'];

/** Grambank data for the quiz, loaded on demand. */
export function useTypologyData(): { ctx: QuestionContext | null; error: boolean } {
  const { core } = useApp();
  const [data, setData] = useState<{ gb: GrambankData; features: Feature[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    Promise.all([loadGrambank(), loadFeatures()])
      .then(([gb, features]) => setData({ gb, features }))
      .catch(() => setError(true));
  }, []);
  const ctx = useMemo(() => (data ? { core, gb: data.gb, features: data.features } : null), [core, data]);
  return { ctx, error };
}

/**
 * Ten questions generated from one seeded PRNG: the same seed (and data)
 * always yields the same series — that is what makes typology duels fair.
 */
export function generateSeries(ctx: QuestionContext, difficulty: TypologyDifficulty, domain: string, seed: number): Question[] {
  const rng: Rng = mulberry32(seed);
  const asked = new Set<string>();
  const out: Question[] = [];
  for (let i = 0; i < SERIES; i++) {
    const q = generateQuestion(ctx, difficulty, rng, { domain: domain || undefined, avoid: asked });
    if (!q) break;
    asked.add(q.feature.id);
    out.push(q);
  }
  return out;
}

export function Typology() {
  const { t } = useApp();
  const { ctx, error } = useTypologyData();
  const progress = useProgress();
  const [diff, setDiff] = useState<TypologyDifficulty>(() => readJSON('gg-typo-diff', 'easy'));
  const [domain, setDomain] = useState<string>(() => readJSON('gg-typo-domain', ''));
  const [seed, setSeed] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const stats = typologyStats(progress, (r) => r.difficulty === diff && (r.domain || '') === domain);

  const start = () => {
    writeJSON('gg-typo-diff', diff);
    writeJSON('gg-typo-domain', domain);
    setScore(null);
    setFailed(false);
    setSeed((Math.random() * 2 ** 32) >>> 0);
  };

  const finish = (s: number) => {
    const at = Date.now();
    updateProgress((p) => recordTypology(p, `${at}-${Math.random().toString(36).slice(2, 7)}`, { at, difficulty: diff, domain, score: s, total: SERIES }));
    setScore(s);
    setSeed(null);
  };

  if (error) return <p class="notice">{t.loadError}</p>;

  return (
    <section class="typology">
      <header class="typo-head">
        <h1>{t.typologyTitle}</h1>
        <div class="head-actions">
          {seed == null && <ChallengeButton game="typology" difficulty={diff} domain={domain} />}
          <button class="icon-btn" onClick={() => setShowStats(true)} title={t.typologyStats} aria-label={t.typologyStats}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M5 20V11M12 20V4M19 20v-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {seed != null && ctx ? (
        <TypologySeries ctx={ctx} difficulty={diff} domain={domain} seed={seed} onFinish={finish} onEmpty={() => { setFailed(true); setSeed(null); }} />
      ) : score != null ? (
        <div class="panel typo-done">
          <p class="big-score">
            {score}
            <small>/{SERIES}</small>
          </p>
          <p>{fmt(t.seriesDone, { n: score, total: SERIES })}</p>
          <p class="muted">{fmt(t.best, { n: stats.best, total: SERIES })}</p>
          <div class="row">
            <button class="btn primary" onClick={start}>
              {t.playAgain}
            </button>
            <button class="btn" onClick={() => setScore(null)}>
              {t.topic}
            </button>
            <ChallengeButton game="typology" difficulty={diff} domain={domain} />
          </div>
        </div>
      ) : (
        <div class="panel typo-setup">
          <p class="lede">{t.typologyIntro}</p>
          <TypologyOptions diff={diff} setDiff={setDiff} domain={domain} setDomain={setDomain} />
          {failed && <p class="notice">{t.noQuestion}</p>}
          <div class="row">
            <button class="btn primary big" onClick={start} disabled={!ctx}>
              {ctx ? t.start : '…'}
            </button>
            <span class="muted">{fmt(t.best, { n: stats.best, total: SERIES })}</span>
          </div>
        </div>
      )}

      {showStats && (
        <Modal title={t.typologyStats} onClose={() => setShowStats(false)}>
          <TypologyStatsView />
        </Modal>
      )}
    </section>
  );
}

export function TypologyOptions({ diff, setDiff, domain, setDomain }: {
  diff: TypologyDifficulty;
  setDiff: (d: TypologyDifficulty) => void;
  domain: string;
  setDomain: (d: string) => void;
}) {
  const { t } = useApp();
  return (
    <>
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
    </>
  );
}

function TypologyStatsView() {
  const { t, user } = useApp();
  const progress = useProgress();
  const groups: [string, (r: { difficulty: string }) => boolean][] = [
    [t.easy, (r) => r.difficulty === 'easy'],
    [t.hardTypo, (r) => r.difficulty === 'hard'],
  ];
  const all = typologyStats(progress);
  const max = Math.max(1, ...all.distribution);
  return (
    <div class="stats">
      <div class="stat-tiles">
        <div class="tile"><b>{all.played}</b><span>{t.played}</span></div>
        <div class="tile"><b>{all.average.toFixed(1)}</b><span>{t.avgScore}</span></div>
        {groups.map(([label, f]) => (
          <div class="tile" key={label}><b>{typologyStats(progress, f).best}</b><span>{t.bestScore} · {label}</span></div>
        ))}
      </div>
      <h3>{t.scoreDistribution}</h3>
      <ol class="dist">
        {all.distribution.map((v, i) => (
          <li key={i}>
            <span class="dist-k">{i}</span>
            <span class="dist-bar" style={{ width: `${Math.max(6, (100 * v) / max)}%` }}>
              {v}
            </span>
          </li>
        ))}
      </ol>
      <p class="muted small">{user ? t.synced : t.syncNote}</p>
    </div>
  );
}

/** A ten-question series. Calls onFinish with the score after the last answer. */
export function TypologySeries({ ctx, difficulty, domain, seed, onFinish, onEmpty }: {
  ctx: QuestionContext;
  difficulty: TypologyDifficulty;
  domain: string;
  seed: number;
  onFinish: (score: number) => void;
  onEmpty?: () => void;
}) {
  const { t } = useApp();
  const questions = useMemo(() => generateSeries(ctx, difficulty, domain, seed), [ctx, difficulty, domain, seed]);
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!questions.length) onEmpty?.();
  }, [questions]);
  if (!questions.length) return null;
  const q = questions[n];

  const answer = (gc: string) => {
    if (chosen) return;
    setChosen(gc);
    if (gc === q.answer) setScore((s) => s + 1);
  };
  const advance = () => {
    if (n + 1 >= questions.length) {
      onFinish(score);
      return;
    }
    setN(n + 1);
    setChosen(null);
    top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <div ref={top}>
      <div class="typo-progress">
        <span>{fmt(t.questionN, { n: n + 1, total: questions.length })}</span>
        <span class="typo-score">
          {t.score}: <b>{score}</b>
        </span>
      </div>
      <div class="progress-bar" aria-hidden="true">
        <span style={{ width: `${((n + (chosen ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>
      <QuestionView q={q} gb={ctx.gb} chosen={chosen} onAnswer={answer} onNext={advance} last={n + 1 >= questions.length} />
    </div>
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
  return (
    <div class="panel question">
      <p class="q-domain">{t.domains[f.domain] ?? f.domain}</p>
      <h2 class="q-text">{questionText(f, q.value, t)}</h2>
      <div class="options">
        {q.options.map((gc) => {
          const v = gb.values[gc][q.featureIndex];
          const state = !chosen ? '' : gc === q.answer ? ' correct' : gc === chosen ? ' wrong' : ' dim';
          const topId = topNode(core, gc);
          const area = core.languages[gc][2];
          return (
            <div key={gc} class={`option${state}`}>
              <button class="option-btn" onClick={() => onAnswer(gc)} disabled={!!chosen}>
                <span class="opt-name">{name(gc)}</span>
                <span class="opt-meta">
                  {topId === gc ? t.cardIsolate : name(topId)}
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
