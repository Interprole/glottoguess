import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { AppContext, type AppCtx } from './app-context';
import { About } from './components/About';
import { GuessGame } from './components/GuessGame';
import { LanguageCard } from './components/LanguageCard';
import { Logo } from './components/Logo';
import { Rules } from './components/Rules';
import { Typology } from './components/Typology';
import { buildSearchIndex, displayName, loadCore, loadMeta, loadNames } from './lib/data';
import { t } from './lib/i18n';
import { readJSON, writeJSON } from './lib/storage';
import type { CoreData, MetaData, NamesData } from './lib/types';

type Route = 'play' | 'typology' | 'rules' | 'about';
const ROUTES: Route[] = ['play', 'typology', 'rules', 'about'];

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (ROUTES as string[]).includes(h) ? (h as Route) : 'play';
}

type Theme = 'light' | 'dark';
function initialTheme(): Theme {
  const saved = readJSON<Theme | null>('lb-theme', null);
  if (saved) return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [core, setCore] = useState<CoreData | null>(null);
  const [names, setNames] = useState<NamesData | null>(null);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [error, setError] = useState(false);
  const [card, setCard] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    loadCore()
      .then((c) => {
        setCore(c);
        // alternative names are only needed for autocomplete: fetch them right after
        loadNames().then(setNames).catch(() => undefined);
      })
      .catch(() => setError(true));
    loadMeta().then(setMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#11181b' : '#f3eee3');
  }, [theme]);

  const index = useMemo(() => (core ? buildSearchIndex(core, names) : null), [core, names]);
  const openCard = useCallback((id: string) => setCard(id), []);

  const ctx = useMemo<AppCtx | null>(
    () =>
      core && index
        ? { core, index, t, name: (id: string) => displayName(core, id), openCard }
        : null,
    [core, index, openCard],
  );

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    writeJSON('lb-theme', next);
  };

  const nav: [Route, string][] = [
    ['play', t.navDaily],
    ['typology', t.navTypology],
    ['rules', t.navRules],
    ['about', t.navAbout],
  ];

  return (
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="#/play" aria-label="LangBang">
          <Logo />
          <span class="brand-text">
            <span class="brand-name">LangBang</span>
            <span class="brand-tag">{t.tagline}</span>
          </span>
        </a>
        <div class="top-actions">
          <button
            class="icon-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? t.themeLight : t.themeDark}
            aria-label={theme === 'dark' ? t.themeLight : t.themeDark}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
        <nav class="tabs" aria-label="Main">
          {nav.map(([r, label]) => (
            <a key={r} href={`#/${r}`} class={route === r ? 'tab active' : 'tab'} aria-current={route === r ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
      </header>

      <main class="content">
        {error ? (
          <p class="notice">{t.loadError}</p>
        ) : !ctx ? (
          route === 'about' ? (
            <About meta={meta} />
          ) : (
            <Loading label={t.loading} />
          )
        ) : (
          <AppContext.Provider value={ctx}>
            {route === 'play' && <GuessGame />}
            {route === 'typology' && <Typology />}
            {route === 'rules' && <Rules />}
            {route === 'about' && <About meta={meta} />}
            {card && <LanguageCard id={card} onClose={() => setCard(null)} />}
          </AppContext.Provider>
        )}
      </main>

      <footer class="footer">
        <p>
          {t.footerData}:{' '}
          <a href="https://glottolog.org" target="_blank" rel="noopener">
            {meta?.datasets.glottolog.title ?? 'Glottolog'}
          </a>{' '}
          ·{' '}
          <a href="https://grambank.clld.org" target="_blank" rel="noopener">
            {meta?.datasets.grambank.title ?? 'Grambank'}
          </a>{' '}
          ·{' '}
          <a href="https://wals.info" target="_blank" rel="noopener">
            {meta?.datasets.wals.title ?? 'WALS Online'}
          </a>{' '}
          — {t.footerLicense}. <a href="#/about">{t.navAbout}</a> ·{' '}
          <a href="https://github.com/Interprole/langbang" target="_blank" rel="noopener">
            {t.footerCode}
          </a>
        </p>
      </footer>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div class="loading" role="status">
      <Logo class="loading-logo" />
      <p>{label}</p>
    </div>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8" />
      <g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    </svg>
  );
}
