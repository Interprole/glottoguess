import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Strings } from './lib/i18n';
import type { SearchIndex } from './lib/search';
import type { CoreData, Lang } from './lib/types';

export interface AppCtx {
  core: CoreData;
  index: SearchIndex;
  lang: Lang;
  t: Strings;
  /** display name in the current UI language */
  name: (id: string) => string;
  openCard: (id: string) => void;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext missing');
  return ctx;
}
