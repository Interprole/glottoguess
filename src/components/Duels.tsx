import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp } from '../app-context';
import { decodeTarget, encodeTarget, rankResults, type Duel, type DuelResult, type DuelSpec } from '../lib/duel';
import { attemptsUsed, newGame, type GameState } from '../lib/game';
import { fmt } from '../lib/i18n';
import { pick } from '../lib/random';
import { readJSON, writeJSON } from '../lib/storage';
import { useProgress } from '../lib/store';
import type { TypologyDifficulty } from '../lib/typology';
import type { Difficulty } from '../lib/types';
import { copyText, GuessBoard } from './GuessBoard';
import { pools } from '../lib/pools';
import { Modal } from './Modal';
import { SERIES, TypologyOptions, TypologySeries, useTypologyData } from './Typology';

const cloud = () => import('../lib/cloud');
export const duelUrl = (id: string) => `${location.origin}${location.pathname}#/duel/${id}`;

// ---------------------------------------------------------------- creating

type ChallengeProps =
  | { game: 'guess'; difficulty: Difficulty }
  | { game: 'typology'; difficulty: TypologyDifficulty; domain: string };

export function ChallengeButton(props: ChallengeProps) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button class="btn small duel-btn" onClick={() => setOpen(true)}>
        ⚔️ {t.challenge}
      </button>
      {open && (
        <Modal title={t.challenge} onClose={() => setOpen(false)}>
          <CreateDuel {...props} />
        </Modal>
      )}
    </>
  );
}

function CreateDuel(props: ChallengeProps) {
  const { t, core, user, signIn } = useApp();
  const [diff, setDiff] = useState<string>(props.difficulty);
  const [domain, setDomain] = useState(props.game === 'typology' ? props.domain : '');
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const pool = useMemo(() => pools(core), [core]);

  if (!user) {
    return (
      <div class="duel-create">
        <p>{t.duelsIntro}</p>
        <p class="muted">{t.duelNeedSignIn}</p>
        <button class="btn primary" onClick={() => signIn()}>
          <GoogleG /> {t.signIn}
        </button>
      </div>
    );
  }

  const create = async () => {
    setBusy(true);
    setErr('');
    try {
      const spec: DuelSpec =
        props.game === 'guess'
          ? { game: 'guess', difficulty: diff as Difficulty, t: encodeTarget(pick(pool[diff as Difficulty], Math.random)) }
          : { game: 'typology', difficulty: diff as TypologyDifficulty, domain, seed: (Math.random() * 2 ** 32) >>> 0 };
      const c = await cloud();
      setId(await c.createDuel(spec));
    } catch (e) {
      console.error(e);
      setErr(t.duelError);
    } finally {
      setBusy(false);
    }
  };

  if (id) {
    const url = duelUrl(id);
    return (
      <div class="duel-create">
        <p>{t.duelCreated}</p>
        <div class="link-box">
          <input readOnly value={url} onFocus={(e) => (e.target as HTMLInputElement).select()} />
        </div>
        <div class="row">
          <button
            class="btn primary"
            onClick={async () => {
              await copyText(url);
              setCopied(true);
            }}
          >
            {copied ? t.linkCopied : t.copyLink}
          </button>
          <a class="btn" href={`#/duel/${id}`}>
            {t.playNow}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div class="duel-create">
      <p>{t.duelsIntro}</p>
      {props.game === 'guess' ? (
        <>
          <div class="seg" role="group">
            <button class={diff === 'normal' ? 'on' : ''} onClick={() => setDiff('normal')}>
              {t.normal}
            </button>
            <button class={diff === 'hard' ? 'on' : ''} onClick={() => setDiff('hard')}>
              {t.hard}
            </button>
          </div>
          <p class="muted small">{t.duelHardcoreNote}</p>
        </>
      ) : (
        <TypologyOptions diff={diff as TypologyDifficulty} setDiff={setDiff} domain={domain} setDomain={setDomain} />
      )}
      {err && <p class="notice">{err}</p>}
      <button class="btn primary" onClick={create} disabled={busy}>
        {busy ? t.creatingDuel : t.createDuel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- list

export function DuelsPage() {
  const { t, user, signIn } = useApp();
  const progress = useProgress();
  const ids = Object.entries(progress.duels).sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 50);
  const [duels, setDuels] = useState<Record<string, Duel | null>>({});

  useEffect(() => {
    if (!user) return;
    let alive = true;
    cloud().then(async (c) => {
      for (const id of ids) {
        if (id in duels) continue;
        const d = await c.getDuel(id).catch(() => null);
        if (alive) setDuels((m) => ({ ...m, [id]: d }));
      }
    });
    return () => {
      alive = false;
    };
  }, [user, ids.join()]);

  return (
    <section class="prose duels">
      <h1>{t.duelsTitle}</h1>
      <p>{t.duelsIntro}</p>
      <div class="row">
        <a class="btn" href="#/play">⚔️ {t.navDaily}</a>
        <a class="btn" href="#/typology">⚔️ {t.navTypology}</a>
      </div>
      <h2>{t.duelMine}</h2>
      {!user ? (
        <div class="panel">
          <p>{t.duelNeedSignIn}</p>
          <button class="btn primary" onClick={() => signIn()}>
            <GoogleG /> {t.signIn}
          </button>
        </div>
      ) : ids.length === 0 ? (
        <p class="muted">{t.duelNone}</p>
      ) : (
        <ul class="duel-list">
          {ids.map((id) => {
            const d = duels[id];
            return (
              <li key={id} class="panel duel-item">
                <div>
                  <b>{d ? duelTitle(d.spec, t) : '…'}</b>
                  {d && (
                    <span class="muted small">
                      {' '}
                      · {fmt(t.duelBy, { name: d.creatorName })} · {new Date(d.createdAt).toLocaleDateString('en')}
                    </span>
                  )}
                </div>
                <a class="btn small" href={`#/duel/${id}`}>
                  {t.duelOpen}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function duelTitle(spec: DuelSpec, t: ReturnType<typeof useApp>['t']): string {
  if (spec.game === 'guess') return fmt(t.duelGuess, { diff: spec.difficulty === 'hard' ? t.hard : t.normal });
  return fmt(t.duelTypology, {
    diff: spec.difficulty === 'hard' ? t.hardTypo : t.easy,
    topic: spec.domain ? t.domains[spec.domain] ?? spec.domain : t.allTopics,
  });
}

// ---------------------------------------------------------------- one duel

export function DuelPage({ id }: { id: string }) {
  const { t, user, signIn } = useApp();
  const [duel, setDuel] = useState<Duel | null | undefined>(undefined);
  const [mine, setMine] = useState<DuelResult | null | undefined>(undefined);
  const [results, setResults] = useState<DuelResult[] | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    const c = await cloud();
    try {
      const d = await c.getDuel(id);
      setDuel(d);
      if (!d) return;
      const m = await c.getMyResult(id);
      setMine(m);
      setResults(await c.listResults(id));
    } catch (e) {
      console.error(e);
      setError(t.duelError);
    }
  };

  useEffect(() => {
    setDuel(undefined);
    setMine(undefined);
    setResults(undefined);
    if (user) refresh();
  }, [id, user?.uid]);

  if (!user) {
    return (
      <section class="prose">
        <h1>⚔️ {t.duelsTitle}</h1>
        <p>{t.duelsIntro}</p>
        <div class="panel">
          <p>{t.duelNeedSignIn}</p>
          <button class="btn primary" onClick={() => signIn()}>
            <GoogleG /> {t.signIn}
          </button>
        </div>
      </section>
    );
  }
  if (error) return <p class="notice">{error}</p>;
  if (duel === undefined || (duel && mine === undefined)) return <p class="muted">{t.duelLoading}</p>;
  if (duel === null) return <p class="notice">{t.duelNotFound}</p>;

  const isCreator = duel.creatorUid === user.uid;
  const header = (
    <header class="duel-head">
      <div>
        <p class="q-domain">⚔️ {fmt(t.duelBy, { name: duel.creatorName })}</p>
        <h1>{duelTitle(duel.spec, t)}</h1>
      </div>
      <button
        class="btn small"
        onClick={async () => {
          await copyText(duelUrl(id));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? t.linkCopied : t.copyLink}
      </button>
    </header>
  );

  const board = (
    <Leaderboard game={duel.spec.game} results={results ?? null} me={user.uid} creator={duel.creatorUid} total={duel.spec.game === 'typology' ? SERIES : 0} />
  );

  if (mine) {
    return (
      <section class="duel">
        {header}
        {board}
      </section>
    );
  }

  return (
    <section class="duel">
      {header}
      {isCreator && results && results.length > 0 && board}
      {duel.spec.game === 'guess' ? (
        <GuessDuel duel={duel} onDone={refresh} />
      ) : (
        <TypologyDuel duel={duel} onDone={refresh} />
      )}
    </section>
  );
}

function useSubmit(id: string, onDone: () => void) {
  const { t } = useApp();
  const [err, setErr] = useState('');
  const submit = async (r: Omit<DuelResult, 'uid' | 'name' | 'photo'>) => {
    try {
      const c = await cloud();
      await c.submitResult(id, r);
      onDone();
    } catch (e) {
      console.error(e);
      setErr(t.duelSubmitError);
    }
  };
  return { submit, err };
}

function GuessDuel({ duel, onDone }: { duel: Duel; onDone: () => void }) {
  const { core, t } = useApp();
  const spec = duel.spec as Extract<DuelSpec, { game: 'guess' }>;
  const target = decodeTarget(spec.t);
  const key = `gg-duel-${duel.id}`;
  const [game, setGame] = useState<GameState>(() => {
    const saved = readJSON<GameState | null>(key, null);
    return saved && saved.target === target ? saved : newGame(target);
  });
  const { submit, err } = useSubmit(duel.id, onDone);

  // a finished local game whose result was not saved yet (e.g. offline): retry
  useEffect(() => {
    if (game.status !== 'playing') sendResult(game);
  }, []);

  if (!(target in core.languages)) return <p class="notice">{t.duelNotFound}</p>;

  function sendResult(g: GameState) {
    submit({ score: attemptsUsed(g), total: 20, won: g.status === 'won', gaveUp: !!g.gaveUp, finishedAt: Date.now() });
  }

  const update = (next: GameState) => {
    setGame(next);
    writeJSON(key, next);
    if (next.status !== 'playing' && game.status === 'playing') sendResult(next);
  };

  return (
    <>
      {err && <p class="notice">{err}</p>}
      <GuessBoard game={game} onChange={update} difficulty={spec.difficulty} puzzle={null} shareLabel={t.duelsTitle} />
    </>
  );
}

function TypologyDuel({ duel, onDone }: { duel: Duel; onDone: () => void }) {
  const { t } = useApp();
  const spec = duel.spec as Extract<DuelSpec, { game: 'typology' }>;
  const { ctx, error } = useTypologyData();
  const [playing, setPlaying] = useState(false);
  const { submit, err } = useSubmit(duel.id, onDone);
  if (error) return <p class="notice">{t.loadError}</p>;
  if (!ctx) return <p class="muted">{t.duelLoading}</p>;
  if (!playing) {
    return (
      <div class="panel">
        <p class="lede">{t.typologyIntro}</p>
        <button class="btn primary big" onClick={() => setPlaying(true)}>
          {t.duelPlay}
        </button>
      </div>
    );
  }
  return (
    <>
      {err && <p class="notice">{err}</p>}
      <TypologySeries
        ctx={ctx}
        difficulty={spec.difficulty}
        domain={spec.domain}
        seed={spec.seed}
        onFinish={(score) => submit({ score, total: SERIES, finishedAt: Date.now() })}
      />
    </>
  );
}

function Leaderboard({ game, results, me, creator, total }: {
  game: DuelSpec['game'];
  results: DuelResult[] | null;
  me: string;
  creator: string;
  total: number;
}) {
  const { t } = useApp();
  return (
    <div class="panel leaderboard">
      <h2 class="panel-title">{t.duelResults}</h2>
      {results === null ? (
        <p class="muted">{t.duelHidden}</p>
      ) : results.length === 0 ? (
        <p class="muted">{t.duelNoResults}</p>
      ) : (
        <ol class="lb-list">
          {rankResults(game, results).map((r, i) => (
            <li key={r.uid} class={r.uid === me ? 'me' : ''}>
              <span class="lb-rank">{i + 1}</span>
              {r.photo ? <img class="lb-photo" src={r.photo} alt="" referrerpolicy="no-referrer" /> : <span class="lb-photo blank" />}
              <span class="lb-name">
                {r.name}
                {r.uid === me && <span class="tag">{t.duelYou}</span>}
                {r.uid === creator && <span class="tag">{t.duelCreator}</span>}
              </span>
              <span class="lb-score">
                {game === 'guess'
                  ? r.won
                    ? fmt(t.duelWon, { n: r.score })
                    : r.gaveUp
                      ? t.duelGaveUp
                      : t.duelLost
                  : fmt(t.duelScore, { n: r.score, total: r.total || total })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
