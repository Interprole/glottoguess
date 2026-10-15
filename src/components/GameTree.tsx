import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../app-context';
import { glottologUrl } from '../lib/data';
import { fmt } from '../lib/i18n';
import { tier, type GuessResult, type Tier } from '../lib/game';
import { areaName, isArea, isVirtual, pathTo, WORLD } from '../lib/tree';

interface Props {
  target: string;
  results: GuessResult[];
  status: 'playing' | 'won' | 'lost';
}

const TOP = 30;
const STATION_H = 52;
const LEAF_H = 46;
const TRUNK_X = 24;
const LEAF_X = 72;

type StationRow = { idx: number; id: string; y: number; leaves: { r: GuessResult; y: number }[] };

/**
 * The tree that grows with every guess.
 *
 * The vertical "trunk" is the path from the root down to the mystery
 * language, but only the nodes revealed so far are drawn as stations (each is
 * the lowest common node of some guess and the answer). Guesses hang off their
 * station as leaves, labelled with the branch they took. Small dots on the
 * trunk count the classification levels that are still hidden between two
 * stations. Non-genealogical levels (world, macroarea) are dashed.
 */
export function GameTree({ target, results, status }: Props) {
  const { core, t, name, openCard } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width || 360);
    return () => ro.disconnect();
  }, []);

  const pt = pathTo(core, target);
  const won = status === 'won';
  const idxs = new Set<number>([0]);
  for (const r of results) if (!r.correct) idxs.add(r.lca);
  if (won) idxs.add(pt.length - 1);
  const sorted = [...idxs].sort((a, b) => a - b);

  // ---- layout
  let y = TOP;
  const stations: StationRow[] = [];
  for (const idx of sorted) {
    const st: StationRow = { idx, id: pt[idx], y, leaves: [] };
    const leaves = results.filter((r) => !r.correct && r.lca === idx);
    y += leaves.length ? 40 : STATION_H;
    for (const r of leaves) {
      st.leaves.push({ r, y });
      y += LEAF_H;
    }
    if (leaves.length) y += 6;
    stations.push(st);
  }
  const mysteryY = won ? null : y + 14;
  const height = mysteryY != null ? mysteryY + 34 : y + 4;

  const chars = (x: number, px = 8.4) => Math.max(8, Math.floor((width - x - 10) / px));
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  const tierOf = (r: GuessResult): Tier => tier(core, r, target);

  const stationLabel = (id: string) => {
    if (id === WORLD) return t.treeRoot;
    if (isArea(id)) return t.areas[areaName(id)] ?? areaName(id);
    return name(id);
  };

  return (
    <div class="tree-wrap" ref={ref}>
      <svg class="tree" width="100%" height={height} role="img" aria-label={t.treeTitle}>
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--t-correct)" stop-opacity="0.55" />
            <stop offset="100%" stop-color="var(--t-correct)" stop-opacity="0" />
          </radialGradient>
        </defs>

        {/* trunk segments between revealed stations */}
        {stations.slice(1).map((st, k) => {
          const prev = stations[k];
          const virtual = isVirtual(prev.id);
          const hidden = st.idx - prev.idx - 1;
          const y1 = prev.y + 9;
          const y2 = st.y - 9;
          const dots = Math.min(hidden, 14);
          return (
            <g key={`seg-${prev.id}-${st.id}`} class="seg">
              <path
                class={virtual ? 'trunk trunk-area' : 'trunk'}
                d={`M${TRUNK_X} ${y1} V${y2}`}
                pathLength={virtual ? undefined : 1}
              />
              {Array.from({ length: dots }, (_, i) => (
                <circle
                  key={i}
                  class="hidden-dot"
                  cx={TRUNK_X}
                  cy={y1 + ((i + 1) * (y2 - y1)) / (dots + 1)}
                  r={2.3}
                >
                  <title>{hidden === 1 ? t.hiddenLevel : fmt(t.hiddenLevels, { n: hidden })}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {/* the unknown remainder of the path */}
        {mysteryY != null && (
          <path
            key={`tail-${stations[stations.length - 1].id}`}
            class="trunk trunk-tail"
            d={`M${TRUNK_X} ${stations[stations.length - 1].y + 9} V${mysteryY - 13}`}
          />
        )}

        {/* branches to guesses */}
        {stations.map((st) =>
          st.leaves.map(({ r, y: ly }) => (
            <path
              key={`br-${r.id}`}
              class={`branch t-${tierOf(r)}`}
              d={`M${TRUNK_X} ${st.y + 4} C${TRUNK_X + 1} ${ly}, ${TRUNK_X + 14} ${ly}, ${LEAF_X - 8} ${ly}`}
              pathLength={1}
            />
          )),
        )}

        {/* stations */}
        {stations.map((st) => {
          const isTarget = won && st.idx === pt.length - 1;
          const virtual = isVirtual(st.id);
          const area = isArea(st.id);
          const label = clip(stationLabel(st.id), chars(TRUNK_X + 20, isTarget ? 9.6 : 9));
          return (
            <g key={`st-${st.id}`} class={`station${virtual ? ' virtual' : ''}${isTarget ? ' target' : ''}`}>
              {isTarget && <circle cx={TRUNK_X} cy={st.y} r={26} fill="url(#glow)" class="glow" />}
              {st.id === WORLD ? (
                <>
                  <circle class="node-world" cx={TRUNK_X} cy={st.y} r={8} />
                  <circle class="node-world-inner" cx={TRUNK_X} cy={st.y} r={3} />
                </>
              ) : area ? (
                <rect class="node-area" x={TRUNK_X - 6.5} y={st.y - 6.5} width={13} height={13} rx={2} transform={`rotate(45 ${TRUNK_X} ${st.y})`} />
              ) : (
                <circle class={isTarget ? 'node-target' : 'node-family'} cx={TRUNK_X} cy={st.y} r={isTarget ? 9 : 6.5} />
              )}
              {isTarget ? (
                <text
                  class="station-label target-label clickable"
                  x={TRUNK_X + 22}
                  y={st.y}
                  dominant-baseline="middle"
                  onClick={() => openCard(st.id)}
                >
                  {label}
                </text>
              ) : virtual ? (
                <text class="station-label" x={TRUNK_X + 20} y={st.y - (area ? 5 : 0)} dominant-baseline="middle">
                  {label}
                </text>
              ) : (
                <a href={glottologUrl(st.id)} target="_blank" rel="noopener">
                  <text class="station-label genealogical" x={TRUNK_X + 20} y={st.y} dominant-baseline="middle">
                    {label}
                  </text>
                </a>
              )}
              {area && (
                <text class="area-note" x={TRUNK_X + 20} y={st.y + 12} dominant-baseline="middle">
                  {t.areaNotKinship}
                </text>
              )}
            </g>
          );
        })}

        {/* leaves */}
        {stations.map((st) =>
          st.leaves.map(({ r, y: ly }) => {
            const tr = tierOf(r);
            const via = r.branchId && r.branchId !== r.id ? fmt(t.via, { name: stationLabel(r.branchId) }) : '';
            const dist = r.km != null ? fmt(t.distance, { km: Math.round(r.km).toLocaleString('en') }) : '';
            const meta = [via, dist].filter(Boolean).join(' · ');
            return (
              <g key={`lf-${r.id}`} class={`leaf t-${tr}`}>
                <circle class="leaf-node" cx={LEAF_X} cy={ly} r={6.5} />
                <text
                  class="leaf-label clickable"
                  x={LEAF_X + 14}
                  y={ly - 7}
                  dominant-baseline="middle"
                  onClick={() => openCard(r.id)}
                >
                  {clip(name(r.id), chars(LEAF_X + 14, 8.6))}
                </text>
                {r.bearing != null && <Arrow x={LEAF_X + 19} y={ly + 11} deg={r.bearing} />}
                <text
                  class="leaf-meta"
                  x={LEAF_X + (r.bearing != null ? 29 : 14)}
                  y={ly + 11}
                  dominant-baseline="middle"
                >
                  {clip(meta, chars(LEAF_X + 29, 6.6))}
                </text>
              </g>
            );
          }),
        )}

        {/* mystery node */}
        {mysteryY != null && (
          <g key="mystery" class={`mystery${status === 'lost' ? ' revealed' : ''}`}>
            <circle class="mystery-pulse" cx={TRUNK_X} cy={mysteryY} r={12} />
            <circle class="mystery-node" cx={TRUNK_X} cy={mysteryY} r={12} />
            <text class="mystery-q" x={TRUNK_X} y={mysteryY + 1} text-anchor="middle" dominant-baseline="middle">
              ?
            </text>
            {status === 'lost' ? (
              <text
                class="station-label clickable"
                x={TRUNK_X + 22}
                y={mysteryY}
                dominant-baseline="middle"
                onClick={() => openCard(target)}
              >
                {clip(name(target), chars(TRUNK_X + 22, 9))}
              </text>
            ) : (
              <text class="mystery-label" x={TRUNK_X + 22} y={mysteryY} dominant-baseline="middle">
                {t.mystery}
              </text>
            )}
          </g>
        )}
      </svg>
      {results.length === 0 && <p class="tree-empty">{t.treeEmpty}</p>}
    </div>
  );
}

function Arrow({ x, y, deg }: { x: number; y: number; deg: number }) {
  return (
    <g class="bearing" transform={`translate(${x} ${y}) rotate(${deg})`}>
      <path d="M0 -6 L4 3 L0 1 L-4 3 Z" />
    </g>
  );
}

export function TierLegend() {
  const { t } = useApp();
  const items: [Tier, string][] = [
    ['world', t.legendWorld],
    ['area', t.legendArea],
    ['family', t.legendFamily],
    ['closer', t.legendCloser],
    ['close', t.legendClose],
    ['correct', t.legendCorrect],
  ];
  return (
    <ul class="legend">
      {items.map(([k, label]) => (
        <li key={k} class={`t-${k}`}>
          <span class="swatch" />
          {label}
        </li>
      ))}
    </ul>
  );
}
