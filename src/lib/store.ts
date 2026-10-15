/**
 * The single place where progress is read and written. Always saved to
 * localStorage; when the player is signed in, the cloud layer (see
 * firebase.ts) registers a remote saver and every change is pushed there too.
 */
import { useEffect, useState } from 'preact/hooks';
import { coerceProgress, emptyProgress, type Progress } from './progress';
import { readJSON, writeJSON } from './storage';

const KEY = 'gg-progress';
type Listener = (p: Progress) => void;

let current: Progress = coerceProgress(readJSON<unknown>(KEY, emptyProgress()));
const listeners = new Set<Listener>();
let remoteSave: ((p: Progress) => void) | null = null;

export function getProgress(): Progress {
  return current;
}

export function setProgress(next: Progress, opts: { remote?: boolean } = {}): void {
  if (next === current) return;
  current = next;
  writeJSON(KEY, current);
  for (const l of listeners) l(current);
  if (opts.remote !== false) remoteSave?.(current);
}

export function updateProgress(fn: (p: Progress) => Progress): void {
  setProgress(fn(current));
}

export function setRemoteSaver(fn: ((p: Progress) => void) | null): void {
  remoteSave = fn;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProgress(): Progress {
  const [p, setP] = useState(current);
  useEffect(() => subscribe(setP), []);
  return p;
}
