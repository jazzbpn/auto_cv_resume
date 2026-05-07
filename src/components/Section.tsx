import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

interface Props {
  title: string;
  open?: boolean;
  children: ComponentChildren;
}

export function Section({ title, open: defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div class="s-group">
      <button
        type="button"
        class={`s-header${open ? ' open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {title}
        <span class="s-arrow" aria-hidden>▾</span>
      </button>
      {open && <div class="s-body">{children}</div>}
    </div>
  );
}
