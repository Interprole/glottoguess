import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp } from '../app-context';
import { dailyAnswer, dayNumber, msUntilNextPuzzle } from '../lib/daily';
import {
  applyGuess, applyHint, attemptsLeft, attemptsUsed, canTakeHint, evaluateGuess, HINT_COST, HINT_KINDS, MAX_ATTEMPTS,
  newGame, shareText, tier, type GameState, type HintKind,
} from '../lib/game';
import { fmt } from '../lib/i18n';
import { pick } from '../lib/random';
import { emptyStats, recordResult, visibleStreak, type PlayerStats } from '../lib/stats';
import { readJSON, writeJSON } from '../lib/storage';
import { areaName, isArea, WORLD } from '../lib/tree';
import { FLAG_HARD, FLAG_NORMAL, type Difficulty } from '../lib/types';
import { Autocomplete } from './Autocomplete';
import { GameTree, TierLegend } from './GameTree';
import { Modal } from './Modal';

type Mode = 'daily' | 'free';

const gameKey = (mode: Mode, diff: Difficulty, day: number) =>
  mode === 'daily' ? `lb-daily-${diff}-${day}` : `lb-free-${diff}`;
const statsKey = (diff: Difficulty) => `lb-stats-${diff}`;
const SALT = 'langbang-daily-v1';

export function GuessGame() {
  const { core, t, name, openCard } = useApp();
  const [mode, setMode] = useState<Mode>(() => readJSON<Mode>('lb-mode', 'daily'));
  const [diff, setDiff] = useState<Difficulty>(() => readJSON<Difficulty>('lb-diff', 'normal'));
  const [day, setDay] = useState(() => dayNumber());
  const [showStats, setShowStats] = useState(false);

  const pools = useMemo(() => {
    const normal: string[] = [];
    const hard: string[] = [];
    for (const [id, row] of Object.entries(core.languages)) {
      if (row[9] & FLAG_HARD) hard.push(id);
      if (row[9] & FLAG_NORMAL) normal.push(id);
    }
    return { normal: normal.sort(), hard: hard.sort() };
  }, [core]);

  const freshGame = (m: Mode, d: Difficulty, dn: number): GameState => {
    const pool = pools[d];
    return newGame(m === 'daily' ? dailyAnswer(pool, dn, `${SALT}:${d}`) : pick(pool, Math.random));
  };

  const loadGame = (m: Mode, d: Difficulty, dn: number): GameState => {
    const saved = readJSON<GameState | null>(gameKey(m, d, dn), null);
    if (saved && saved.target in core.languages) {
      if (m === 'free' || saved.target === dailyAnswer(pools[d], dn, `${SALT}:${d}`)) return saved;
    }
    return freshGame(m, d, dn);
  };

  const [game, setGame] = useState<GameState>(() => loadGame(mode, diff, day));
  const [stats, setStats] = useState<PlayerStats>(() => readJSON(statsKey(diff), emptyStats()));

  // switch mode / difficulty
  useEffect(() => {
    setGame(loadGame(mode, diff, day));
    setStats(readJSON(statsKey(diff), emptyStats()));
    writeJSON('lb-mode', mode);
    writeJSON('lb-diff', diff);
  }, [mode, diff, day]);

  // roll over to the next daily puzzle at 00:00 UTC
  useEffect(() => {
    const id = setTimeout(() => setDay(dayNumber()), msUntilNextPuzzle() + 500);
    return () => clearTimeout(id);
  }, [day]);

  const update = (next: GameState) => {
    if (next === game) return;
    setGame(next);
    writeJSON(gameKey(mode, diff, day), next);
    if (mode === 'daily' && next.status !== 'playing' && game.status === 'playing') {
      const s = recordResult(readJSON(statsKey(diff), emptyStats()), day, next.status === 'won', attemptsUsed(next));
      writeJSON(statsKey(diff), s);
      setStats(s);
      setTimeout(() => setShowStats(true), 1400);
    }
  };

  const results = useMemo(() => game.guesses.map((g) => evaluateGuess(core, g, game.target)), [core, game]);
  const used = useMemo(() => new Set(game.guesses), [game.guesses]);

  const newFree = () => {
    const g = freshGame('free', diff, day);
    setGame(g);
    writeJSON(gameKey('free', diff, day), g);
  };

  return (
    <section class="game">
      <div class="game-head">
        <div class="seg" role="group" aria-label="Mode">
          <button class={mode === 'daily' ? 'on' : ''} onClick={() => setMode('daily')}>
            {t.daily}
          </button>
          <button class={mode === 'free' ? 'on' : ''} onClick={() => setMode('free')}>
            {t.free}
          </button>
        </div>
        <div class="seg" role="group" aria-label="Difficulty">
          <button class={diff === 'normal' ? 'on' : ''} onClick={() => setDiff('normal')}>
            {t.normal}
          </button>
          <button class={diff === 'hard' ? 'on' : ''} onClick={() => setDiff('hard')}>
            {t.hard}
          </button>
        </div>
        <button class="icon-btn stats-btn" onClick={() => setShowStats(true)} title={t.stats} aria-label={t.stats}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M5 20V11M12 20V4M19 20v-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="game-title">
        <h1>
          {mode === 'daily' ? fmt(t.puzzleNo, { n: day }) : t.freeGame}
          <span class="diff-badge">{diff === 'hard' ? t.hard : t.normal}</span>
        </h1>
        <Attempts game={game} />
      </div>

      {game.status === 'playing' ? (
        <div class="guess-bar">
          <Autocomplete onPick={(id) => update(applyGuess(game, id))} exclude={used} />
        </div>
      ) : (
        <EndPanel game={game} mode={mode} diff={diff} day={day} onNew={newFree} />
      )}

      <div class="game-grid">
        <div class="panel tree-panel">
          <h2 class="panel-title">{t.treeTitle}</h2>
          <GameTree target={game.target} results={results} status={game.status} />
          <TierLegend />
        </div>

        <aside class="side">
          <Hints game={game} onHint={(k) => update(applyHint(game, k))} />
          {results.length > 0 && (
            <div class="panel">
              <h2 class="panel-title">{t.guessesTitle}</h2>
              <ol class="guess-list" reversed>
                {[...results].reverse().map((r) => {
                  const tr = tier(core, r, game.target);
                  const meet =
                    r.correct ? t.legendCorrect
                    : r.lcaId === WORLD ? t.noRelation
                    : isArea(r.lcaId) ? `${t.sameArea} (${t.areas[areaName(r.lcaId)] ?? areaName(r.lcaId)})`
                    : `${t.meets} ${name(r.lcaId)}`;
                  return (
                    <li key={r.id} class={`guess t-${tr}`}>
                      <span class="swatch" />
                      <span class="guess-main">
                        <button class="link" onClick={() => openCard(r.id)}>
                          {name(r.id)}
                        </button>
                        <span class="guess-meet">{meet}</span>
                      </span>
                      {!r.correct && r.km != null && (
                        <span class="guess-dist" title={r.dir ? fmt(t.directionTo, { dir: t.dirs[r.dir] }) : ''}>
                          {Math.round(r.km).toLocaleString('en')} km
                          {r.bearing != null && (
                            <svg class="dir" viewBox="-8 -8 16 16" width="16" height="16" style={{ transform: `rotate(${r.bearing}deg)` }} aria-hidden="true">
                              <path d="M0 -6 L4 4 L0 2 L-4 4 Z" />
                            </svg>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </aside>
      </div>

      {showStats && (
        <Modal onClose={() => setShowStats(false)} title={`${t.stats} · ${diff === 'hard' ? t.hard : t.normal}`}>
          <StatsView stats={stats} today={day} />
        </Modal>
      )}
    </section>
  );
}

function Attempts({ game }: { game: GameState }) {
  const { t } = useApp();
  const used = attemptsUsed(game);
  return (
    <div class="attempts" aria-label={fmt(t.attemptsLeft, { n: attemptsLeft(game) })}>
      <div class="attempt-dots">
        {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
          <span
            key={i}
            class={`dot${i < game.guesses.length ? ' used' : i < used ? ' hint' : ''}`}
          />
        ))}
      </div>
      <span class="attempt-count">{fmt(t.attemptsLeft, { n: attemptsLeft(game) })}</span>
    </div>
  );
}

function Hints({ game, onHint }: { game: GameState; onHint: (k: HintKind) => void }) {
  const { core, t } = useApp();
  const row = core.languages[game.target];
  const label: Record<HintKind, string> = { area: t.hintArea, status: t.hintStatus, country: t.hintCountry };
  const reveal = (k: HintKind): string => {
    if (k === 'area') return fmt(t.hintAreaValue, { area: t.areas[row[2] ?? ''] ?? row[2] ?? '?' });
    if (k === 'status') return row[5] ? fmt(t.hintStatusValue, { status: t.aes[row[5]] }) : t.hintStatusUnknown;
    const countries = row[6] ? row[6].split(';') : [];
    if (!countries.length) return t.hintCountryUnknown;
    // deterministic choice so that a reload shows the same country
    const c = countries[game.target.charCodeAt(0) % countries.length];
    let cname = c;
    try {
      cname = new Intl.DisplayNames(['en'], { type: 'region' }).of(c) ?? c;
    } catch {
      /* old browsers */
    }
    return fmt(t.hintCountryValue, { country: cname });
  };
  const over = game.status !== 'playing';
  return (
    <div class="panel hints">
      <h2 class="panel-title">{fmt(t.hintsTitle, { n: HINT_COST })}</h2>
      <div class="hint-buttons">
        {HINT_KINDS.map((k) => {
          const taken = game.hints.includes(k);
          return (
            <button
              key={k}
              class={`hint-btn${taken ? ' taken' : ''}`}
              disabled={taken || over || !canTakeHint(game, k)}
              onClick={() => onHint(k)}
            >
              💡 {label[k]}
            </button>
          );
        })}
      </div>
      {(game.hints.length > 0 || over) && (
        <ul class="hint-list">
          {(over ? HINT_KINDS : game.hints).map((k) => (
            <li key={k} class={game.hints.includes(k) ? '' : 'muted'}>
              {reveal(k)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EndPanel({ game, mode, diff, day, onNew }: { game: GameState; mode: Mode; diff: Difficulty; day: number; onNew: () => void }) {
  const { core, t, name, openCard } = useApp();
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (mode !== 'daily') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode]);
  const won = game.status === 'won';
  const url = location.origin + location.pathname;
  const text = shareText(core, game, {
    puzzle: mode === 'daily' ? day : null,
    difficulty: diff,
    url,
    labels: { normal: t.normal, hard: t.hard, free: t.free },
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const ms = msUntilNextPuzzle(now);
  const hh = String(Math.floor(ms / 3.6e6)).padStart(2, '0');
  const mm = String(Math.floor((ms % 3.6e6) / 6e4)).padStart(2, '0');
  const ss = String(Math.floor((ms % 6e4) / 1000)).padStart(2, '0');
  return (
    <div class={`end-panel ${won ? 'won' : 'lost'}`}>
      <div class="end-msg">
        <strong>{won ? fmt(t.youWin, { n: attemptsUsed(game) }) : t.youLose}</strong>
        <span>
          {t.answerWas}{' '}
          <button class="link answer" onClick={() => openCard(game.target)}>
            {name(game.target)}
          </button>
        </span>
      </div>
      <pre class="share-preview" aria-hidden="true">{text.split('\n').slice(0, -1).join('\n')}</pre>
      <div class="end-actions">
        <button class="btn primary" onClick={copy}>
          {copied ? t.copied : t.copyResult}
        </button>
        <button class="btn" onClick={() => openCard(game.target)}>
          {t.openCard}
        </button>
        {mode === 'free' ? (
          <button class="btn" onClick={onNew}>
            {t.newFreeGame}
          </button>
        ) : (
          <span class="countdown">{fmt(t.nextPuzzle, { t: `${hh}:${mm}:${ss}` })}</span>
        )}
      </div>
    </div>
  );
}

function StatsView({ stats, today }: { stats: PlayerStats; today: number }) {
  const { t } = useApp();
  const max = Math.max(1, ...stats.distribution);
  const lastNonZero = stats.distribution.reduce((acc, v, i) => (v ? i : acc), -1);
  const rows = stats.distribution.slice(0, Math.max(lastNonZero + 1, 10));
  return (
    <div class="stats">
      <div class="stat-tiles">
        <div class="tile"><b>{stats.played}</b><span>{t.played}</span></div>
        <div class="tile"><b>{stats.played ? Math.round((100 * stats.won) / stats.played) : 0}</b><span>{t.winRate}</span></div>
        <div class="tile"><b>{visibleStreak(stats, today)}</b><span>{t.streak}</span></div>
        <div class="tile"><b>{stats.maxStreak}</b><span>{t.maxStreak}</span></div>
      </div>
      <h3>{t.distribution}</h3>
      <ol class="dist">
        {rows.map((v, i) => (
          <li key={i}>
            <span class="dist-k">{i + 1}</span>
            <span class="dist-bar" style={{ width: `${Math.max(6, (100 * v) / max)}%` }}>
              {v}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
