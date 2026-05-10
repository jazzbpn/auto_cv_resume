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
          <SaveIndicator />
        </div>
        <div class="top-actions">
          <button class="import-btn" type="button" onClick={onImport}>⬇ Import CV</button>
          <button class="export-btn" type="button" onClick={() => {
            track('export', {
              template: template.value,
              sections_visible_count: Object.values(visibility.value).filter(Boolean).length,
              ai_used: wasAIUsed(),
            });
            void printResume();
          }}>⬆ Export</button>
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
