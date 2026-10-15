import { useEffect, useRef, useState } from 'preact/hooks';
import type { CloudUser } from '../lib/cloud';
import { t } from '../lib/i18n';
import { GoogleG } from './Duels';

export function AuthButton({ user, signIn }: { user: CloudUser | null; signIn: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  if (!user) {
    return (
      <button class="chip-btn signin" onClick={() => signIn()} title={t.syncNote}>
        <GoogleG /> <span class="signin-label">{t.signIn}</span>
      </button>
    );
  }
  return (
    <div class="user-menu" ref={ref}>
      <button class="avatar-btn" onClick={() => setOpen(!open)} aria-label={t.signedInAs.replace('{name}', user.name)}>
        {user.photo ? <img src={user.photo} alt="" referrerpolicy="no-referrer" /> : <span>{user.name[0]}</span>}
      </button>
      {open && (
        <div class="user-pop">
          <p>{t.signedInAs.replace('{name}', user.name)}</p>
          <p class="muted small">{t.synced}</p>
          <a class="btn small" href="#/duels" onClick={() => setOpen(false)}>
            ⚔️ {t.navDuels}
          </a>
          <button
            class="btn small"
            onClick={async () => {
              setOpen(false);
              const c = await import('../lib/cloud');
              await c.signOut();
            }}
          >
            {t.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
