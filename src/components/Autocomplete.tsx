import { useMemo, useRef, useState } from 'preact/hooks';
import { useApp } from '../app-context';
import { topNode } from '../lib/tree';

interface Props {
  onPick: (id: string) => void;
  exclude: Set<string>;
  disabled?: boolean;
}

export function Autocomplete({ onPick, exclude, disabled }: Props) {
  const { index, t, name, core } = useApp();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => index.search(q, 8), [index, q]);

  const choose = (id: string) => {
    if (exclude.has(id)) return;
    onPick(id);
    setQ('');
    setActive(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (!hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % hits.length);
      setOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const h = hits[active] ?? hits[0];
      if (h) choose(h.id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && q.trim().length > 0;
  return (
    <div class="ac">
      <div class="ac-field">
        <svg class="ac-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls="ac-list"
          aria-autocomplete="list"
          autoComplete="off"
          autoCapitalize="off"
          spellcheck={false}
          placeholder={t.guessPlaceholder}
          value={q}
          disabled={disabled}
          onInput={(e) => {
            setQ((e.target as HTMLInputElement).value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
        />
      </div>
      {showList && (
        <ul class="ac-list" id="ac-list" role="listbox">
          {hits.length === 0 && <li class="ac-empty">{t.noMatches}</li>}
          {hits.map((h, i) => {
            const used = exclude.has(h.id);
            const main = name(h.id);
            const top = topNode(core, h.id);
            const fam = top === h.id ? t.cardIsolate : name(top);
            const area = core.languages[h.id]?.[2];
            return (
              <li
                key={h.id}
                role="option"
                aria-selected={i === active}
                aria-disabled={used}
                class={`ac-item${i === active ? ' active' : ''}${used ? ' used' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(h.id);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span class="ac-name">
                  {main}
                  {h.kind !== 0 && (
                    <span class="ac-alt">
                      {' '}
                      · {t.aka} <em>{h.name}</em>
                    </span>
                  )}
                </span>
                <span class="ac-meta">
                  {used ? t.alreadyGuessed : `${fam}${area ? ' · ' + (t.areas[area] ?? area) : ''}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
