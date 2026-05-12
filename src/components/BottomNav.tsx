import type { MobilePanel } from '../state/ui';
import { cvLang } from '../state/store';
import { getUI } from '../i18n/sections';

interface Props { active: MobilePanel; onSelect: (p: MobilePanel) => void; }

export function BottomNav({ active, onSelect }: Props) {
  const ui = getUI(cvLang.value);
  return (
    <nav class="bottom-nav" aria-label="Mobile views">
      <button
        type="button"
        class={`nav-btn${active === 'edit' ? ' active' : ''}`}
        aria-current={active === 'edit' ? 'page' : undefined}
        onClick={() => onSelect('edit')}
      >
        <span class="nav-icon-pill" aria-hidden>
          <svg class="nav-icon nav-icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <svg class="nav-icon nav-icon-filled" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.71 5.63a1 1 0 0 0 0-1.41l-1.92-1.92a1 1 0 0 0-1.41 0l-1.34 1.34 3.33 3.33 1.34-1.34zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
            <path d="M3 21.5h18v1.5H3z" opacity="0" />
          </svg>
        </span>
        <span class="nav-label">{ui.navEdit}</span>
      </button>
      <button
        type="button"
        class={`nav-btn${active === 'preview' ? ' active' : ''}`}
        aria-current={active === 'preview' ? 'page' : undefined}
        onClick={() => onSelect('preview')}
      >
        <span class="nav-icon-pill" aria-hidden>
          <svg class="nav-icon nav-icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <svg class="nav-icon nav-icon-filled" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd">
            <path d="M12 4.5C5.5 4.5 1.7 9.7 1 12c.7 2.3 4.5 7.5 11 7.5s10.3-5.2 11-7.5c-.7-2.3-4.5-7.5-11-7.5zm0 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
          </svg>
        </span>
        <span class="nav-label">{ui.navPreview}</span>
      </button>
      <button
        type="button"
        class={`nav-btn${active === 'analyse' ? ' active' : ''}`}
        aria-current={active === 'analyse' ? 'page' : undefined}
        onClick={() => onSelect('analyse')}
      >
        <span class="nav-icon-pill" aria-hidden>
          <svg class="nav-icon nav-icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18" />
            <rect x="7" y="13" width="3" height="6" rx="0.5" />
            <rect x="12" y="9" width="3" height="10" rx="0.5" />
            <rect x="17" y="5" width="3" height="14" rx="0.5" />
          </svg>
          <svg class="nav-icon nav-icon-filled" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 3a1 1 0 0 1 1 1v15.5h16a1 1 0 0 1 0 2H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
            <rect x="7" y="13" width="3" height="6" rx="0.5" />
            <rect x="12" y="9" width="3" height="10" rx="0.5" />
            <rect x="17" y="5" width="3" height="14" rx="0.5" />
          </svg>
        </span>
        <span class="nav-label">{ui.navAiScore}</span>
      </button>
    </nav>
  );
}
