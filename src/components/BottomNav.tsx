import type { MobilePanel } from '../state/ui';

interface Props { active: MobilePanel; onSelect: (p: MobilePanel) => void; }

export function BottomNav({ active, onSelect }: Props) {
  return (
    <nav class="bottom-nav" aria-label="Mobile views">
      <button
        type="button"
        class={`nav-btn${active === 'edit' ? ' active' : ''}`}
        onClick={() => onSelect('edit')}
      >
        <span class="nav-icon" aria-hidden>✎</span>Edit
      </button>
      <span class="nav-divider" aria-hidden />
      <button
        type="button"
        class={`nav-btn${active === 'preview' ? ' active' : ''}`}
        onClick={() => onSelect('preview')}
      >
        <span class="nav-icon" aria-hidden>👁</span>Preview
      </button>
      <span class="nav-divider" aria-hidden />
      <button
        type="button"
        class={`nav-btn${active === 'analyse' ? ' active' : ''}`}
        onClick={() => onSelect('analyse')}
      >
        <span class="nav-icon" aria-hidden>✦</span>Score
      </button>
    </nav>
  );
}
