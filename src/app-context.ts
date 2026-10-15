import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Strings } from './lib/i18n';
import type { SearchIndex } from './lib/search';
import type { CloudUser } from './lib/cloud';
import type { CoreData } from './lib/types';

export interface AppCtx {
  core: CoreData;
  index: SearchIndex;
  t: Strings;
  /** display name of a languoid */
  name: (id: string) => string;
  openCard: (id: string) => void;
  /** signed-in Google user (null when signed out or before Firebase has loaded) */
  user: CloudUser | null;
  signIn: () => Promise<void>;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext missing');
  return ctx;
}
