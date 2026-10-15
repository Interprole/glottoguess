import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp } from '../app-context';
import { dailyAnswer, dayNumber, msUntilNextPuzzle } from '../lib/daily';
import { attemptsUsed, newGame, type GameState } from '../lib/game';
import { fmt } from '../lib/i18n';
import { statsFromHistory, visibleStreak, recordDaily, type DayResult } from '../lib/progress';
import { pick } from '../lib/random';
import { readJSON, writeJSON } from '../lib/storage';
import { updateProgress, useProgress } from '../lib/store';
import { pools } from '../lib/pools';
import type { Difficulty } from '../lib/types';
import { ChallengeButton } from './Duels';
import { GuessBoard } from './GuessBoard';
import { Modal } from './Modal';

type Mode = 'daily' | 'free';

const gameKey = (mode: Mode, diff: Difficulty, day: number) => (mode === 'daily' ? `gg-daily-${diff}-${day}` : `gg-free-${diff}`);
const SALT = 'langbang-daily-v1'; // kept stable so the daily sequence does not change with the rename

export function GuessGame() {
  const { core, t } = useApp();
  const progress = useProgress();
  const [mode, setMode] = useState<Mode>(() => readJSON<Mode>('gg-mode', 'daily'));
  const [diff, setDiff] = useState<Difficulty>(() => readJSON<Difficulty>('gg-diff', 'normal'));
  const [day, setDay] = useState(() => dayNumber());
  const [showStats, setShowStats] = useState(false);
  const pool = useMemo(() => pools(core), [core]);
  const dailyTarget = (d: Difficulty, dn: number) => dailyAnswer(pool[d], dn, `${SALT}:${d}`);

  const loadGame = (m: Mode, d: Difficulty, dn: number): GameState => {
    const saved = readJSON<GameState | null>(gameKey(m, d, dn), null);
    if (m === 'free') {
      if (saved && saved.target in core.languages) return saved;
      return newGame(pick(pool[d], Math.random));
    }
    const target = dailyTarget(d, dn);
    if (saved && saved.target === target) return saved;
    // finished on another device? restore the board from the synced history
    const r = progress.guess[d][String(dn)];
    if (r && r.target === target && r.guesses) {
      return { target, guesses: r.guesses, hints: r.hints ?? [], status: r.won ? 'won' : 'lost', gaveUp: r.gaveUp };
    }
    return newGame(target);
  };

  const [game, setGame] = useState<GameState>(() => loadGame(mode, diff, day));

  useEffect(() => {
    setGame(loadGame(mode, diff, day));
    writeJSON('gg-mode', mode);
    writeJSON('gg-diff', diff);
  }, [mode, diff, day]);

  // a daily result synced from another device after load
  useEffect(() => {
    if (mode !== 'daily' || game.guesses.length) return;
    const restored = loadGame(mode, diff, day);
    if (restored.status !== 'playing') setGame(restored);
  }, [progress]);

  useEffect(() => {
    const id = setTimeout(() => setDay(dayNumber()), msUntilNextPuzzle() + 500);
    return () => clearTimeout(id);
  }, [day]);

  const update = (next: GameState) => {
    if (next === game) return;
    setGame(next);
    writeJSON(gameKey(mode, diff, day), next);
    if (mode === 'daily' && next.status !== 'playing' && game.status === 'playing') {
      const r: DayResult = {
        won: next.status === 'won',
        attempts: attemptsUsed(next),
        gaveUp: next.gaveUp,
        target: next.target,
        guesses: next.guesses,
        hints: next.hints,
        at: Date.now(),
      };
      updateProgress((p) => recordDaily(p, diff, day, r));
      setTimeout(() => setShowStats(true), 1400);
    }
  };

  const newFree = () => {
    const g = newGame(pick(pool[diff], Math.random));
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
        <div class="head-actions">
          <ChallengeButton game="guess" difficulty={diff} />
          <button class="icon-btn" onClick={() => setShowStats(true)} title={t.stats} aria-label={t.stats}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M5 20V11M12 20V4M19 20v-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div class="game-title">
        <h1>
          {mode === 'daily' ? fmt(t.puzzleNo, { n: day }) : t.freeGame}
          <span class="diff-badge">{diff === 'hard' ? t.hard : t.normal}</span>
        </h1>
      </div>

      <GuessBoard
        game={game}
        onChange={update}
        difficulty={diff}
        puzzle={mode === 'daily' ? day : null}
        shareLabel={t.free}
        endExtra={mode === 'free' ? (
          <button class="btn" onClick={newFree}>
            {t.newFreeGame}
          </button>
        ) : (
          <Countdown />
        )}
      />

      {showStats && (
        <Modal onClose={() => setShowStats(false)} title={`${t.stats} · ${diff === 'hard' ? t.hard : t.normal}`}>
          <StatsView history={progress.guess[diff]} today={day} />
        </Modal>
      )}
    </section>
  );
}

function Countdown() {
  const { t } = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = msUntilNextPuzzle(now);
  const p = (n: number) => String(n).padStart(2, '0');
  const time = `${p(Math.floor(ms / 3.6e6))}:${p(Math.floor((ms % 3.6e6) / 6e4))}:${p(Math.floor((ms % 6e4) / 1000))}`;
  return <span class="countdown">{fmt(t.nextPuzzle, { t: time })}</span>;
}

function StatsView({ history, today }: { history: Record<string, DayResult>; today: number }) {
  const { t, user } = useApp();
  const stats = statsFromHistory(history);
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
      <p class="muted small">{user ? t.synced : t.syncNote}</p>
    </div>
  );
}
