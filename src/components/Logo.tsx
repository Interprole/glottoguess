/** A branching "L": a language family tree whose root is a map pin. */
export function Logo({ class: cls = 'logo' }: { class?: string }) {
  return (
    <svg class={cls} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" class="logo-ring" />
      <path class="logo-branch" d="M13 31 V12 M13 24 C13 19 21 20 22 13 M13 31 H27 M22 31 C22 27 27 27 28 22" />
      <circle class="logo-leaf" cx="22" cy="12.2" r="2.6" />
      <circle class="logo-leaf alt" cx="28.2" cy="21.5" r="2.6" />
      <circle class="logo-node" cx="13" cy="11.5" r="2.2" />
      <circle class="logo-root" cx="13" cy="31" r="2.4" />
    </svg>
  );
}
