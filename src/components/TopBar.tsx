import { printResume } from '../services/print';
import { saveStatus } from '../state/store';

interface Props { onImport: () => void; }

export function TopBar({ onImport }: Props) {
  return (
    <header class="top-bar">
      <div class="brand-row">
        <div class="brand">CV<span> · </span>PDF</div>
        <span class="free-badge" aria-label="100% Free, no sign-up, no card required">
          <span class="free-badge-dot" aria-hidden />
          100% Free
        </span>
        <SaveIndicator />
      </div>
      <div class="top-actions">
        <button class="import-btn" type="button" onClick={onImport}>⬆ Import CV</button>
        <button class="export-btn" type="button" onClick={() => { void printResume(); }}>⬇ Export</button>
      </div>
    </header>
  );
}

function SaveIndicator() {
  const status = saveStatus.value;
  const label =
    status === 'saving' ? 'Saving…'
    : status === 'error' ? 'Save failed'
    : 'Saved locally';
  return (
    <span
      class={`save-indicator save-${status}`}
      aria-live="polite"
      title={
        status === 'error'
          ? 'Local storage is full or disabled. Your edits live only in this tab.'
          : 'Your changes auto-save to this device. Nothing leaves your browser.'
      }
    >
      <span class="save-dot" aria-hidden />
      {label}
    </span>
  );
}
