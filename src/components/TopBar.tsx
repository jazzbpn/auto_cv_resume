import { printResume } from '../services/print';
import { track, wasAIUsed } from '../services/analytics';
import { saveStatus, template, visibility } from '../state/store';

interface Props { onImport: () => void; }

export function TopBar({ onImport }: Props) {
  return (
    <>
      <div class="free-ribbon" aria-label="100% Free, no sign-up, no card required">
        <span>100% FREE</span>
      </div>
      <header class="top-bar">
        <div class="brand-row">
          <a class="brand-lockup" href="/" aria-label="ResumePDF">
            <span class="brand-name">Resume<span>PDF</span></span>
          </a>
          <span class="free-chip" aria-label="100% free">FREE</span>
          <SaveIndicator />
        </div>
        <div class="top-actions">
          <button class="import-btn" type="button" onClick={onImport} aria-label="Import CV">
            <svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span class="btn-text">Import CV</span>
          </button>
          <button class="export-btn" type="button" aria-label="Export CV" onClick={() => {
            track('export', {
              template: template.value,
              sections_visible_count: Object.values(visibility.value).filter(Boolean).length,
              ai_used: wasAIUsed(),
            });
            void printResume();
          }}>
            <svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span class="btn-text">Export</span>
          </button>
        </div>
      </header>
    </>
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
