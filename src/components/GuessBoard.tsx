import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useApp } from '../app-context';
import {
  applyGuess, applyHint, attemptsLeft, attemptsUsed, canTakeHint, evaluateGuess, giveUp, HINT_COST, HINT_KINDS,
  MAX_ATTEMPTS, shareText, tier, type GameState, type HintKind,
} from '../lib/game';
import { fmt } from '../lib/i18n';
import { areaName, isArea, WORLD } from '../lib/tree';
import type { Difficulty } from '../lib/types';
import { Autocomplete } from './Autocomplete';
import { GameTree, TierLegend } from './GameTree';

interface Props {
  game: GameState;
  onChange: (next: GameState) => void;
  difficulty: Difficulty;
  /** puzzle number for the share text (null for free play / duels) */
  puzzle: number | null;
  shareLabel: string;
  /** extra content for the end panel (countdown, new game, duel results…) */
  endExtra?: ComponentChildren;
}

/** The playing surface shared by daily, free and duel games. */
export function GuessBoard({ game, onChange, difficulty, puzzle, shareLabel, endExtra }: Props) {
  const { core, t, name, openCard } = useApp();
  const results = useMemo(() => game.guesses.map((g) => evaluateGuess(core, g, game.target)), [core, game]);
  const used = useMemo(() => new Set(game.guesses), [game.guesses]);

  const surrender = () => {
    if (confirm(t.giveUpConfirm)) onChange(giveUp(game));
  };

  return (
    <>
      <div class="board-status">
        <Attempts game={game} />
      </div>

      {game.status === 'playing' ? (
        <div class="guess-bar">
          <Autocomplete onPick={(id) => onChange(applyGuess(game, id))} exclude={used} />
        </div>
      ) : (
        <EndPanel game={game} difficulty={difficulty} puzzle={puzzle} shareLabel={shareLabel} extra={endExtra} />
      )}

      <div class="game-grid">
        <div class="panel tree-panel">
          <h2 class="panel-title">{t.treeTitle}</h2>
          <GameTree target={game.target} results={results} status={game.status} />
          <TierLegend />
        </div>

        <aside class="side">
          <Hints game={game} onHint={(k) => onChange(applyHint(game, k))} />
          {results.length > 0 && (
            <div class="panel">
              <h2 class="panel-title">{t.guessesTitle}</h2>
              <ol class="guess-list" reversed>
                {[...results].reverse().map((r) => {
                  const tr = tier(core, r, game.target);
                  const meet = r.correct
                    ? t.legendCorrect
                    : r.lcaId === WORLD
                      ? t.noRelation
                      : isArea(r.lcaId)
                        ? `${t.sameArea} (${t.areas[areaName(r.lcaId)] ?? areaName(r.lcaId)})`
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
          {game.status === 'playing' && (
            <button class="btn ghost giveup" onClick={surrender}>
              🏳️ {t.giveUp}
            </button>
          )}
        </aside>
      </div>
    </>
  );
}

function Attempts({ game }: { game: GameState }) {
  const { t } = useApp();
  const used = attemptsUsed(game);
  return (
    <div class="attempts" aria-label={fmt(t.attemptsLeft, { n: attemptsLeft(game) })}>
      <div class="attempt-dots">
        {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
          <span key={i} class={`dot${i < game.guesses.length ? ' used' : i < used ? ' hint' : ''}`} />
        ))}
      </div>
      <span class="attempt-count">{fmt(t.attemptsLeft, { n: attemptsLeft(game) })}</span>
    </div>
  );
}

function formatSpeakers(n: number): string {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million`;
  return n.toLocaleString('en');
}

function Hints({ game, onHint }: { game: GameState; onHint: (k: HintKind) => void }) {
  const { core, t } = useApp();
  const row = core.languages[game.target];
  const label: Record<HintKind, string> = { area: t.hintArea, status: t.hintStatus, speakers: t.hintSpeakers };
  const reveal = (k: HintKind): string => {
    if (k === 'area') return fmt(t.hintAreaValue, { area: t.areas[row[2] ?? ''] ?? row[2] ?? '?' });
    if (k === 'status') return row[5] ? fmt(t.hintStatusValue, { status: t.aes[row[5]] }) : t.hintStatusUnknown;
    const n = row[10];
    return n != null ? fmt(t.hintSpeakersValue, { n: formatSpeakers(n) }) : t.hintSpeakersNone;
  };
  const over = game.status !== 'playing';
  return (
    <div class="panel hints">
      <h2 class="panel-title">{t.hintsTitle}</h2>
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
              💡 {label[k]} <span class="hint-cost">{fmt(t.hintCostN, { n: HINT_COST[k] })}</span>
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

function EndPanel({ game, difficulty, puzzle, shareLabel, extra }: {
  game: GameState;
  difficulty: Difficulty;
  puzzle: number | null;
  shareLabel: string;
  extra?: ComponentChildren;
}) {
  const { core, t, name, openCard } = useApp();
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [game.target]);
  const won = game.status === 'won';
  const text = shareText(core, game, {
    puzzle,
    difficulty,
    url: location.origin + location.pathname,
    labels: { normal: t.normal, hard: t.hard, free: shareLabel },
  });
  const copy = async () => {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div class={`end-panel ${won ? 'won' : 'lost'}`}>
      <div class="end-msg">
        <strong>{won ? fmt(t.youWin, { n: attemptsUsed(game) }) : game.gaveUp ? t.youGaveUp : t.youLose}</strong>
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
        {extra}
      </div>
    </div>
  );
}

export async function copyText(text: string): Promise<void> {
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
}
