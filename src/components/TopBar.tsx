import { downloadPDF } from '../services/print';
import { track, wasAIUsed } from '../services/analytics';
import { saveStatus, template, visibility, cvLang } from '../state/store';
import { getUI } from '../i18n/sections';

interface Props { onImport: () => void; }

export function TopBar({ onImport }: Props) {
  const ui = getUI(cvLang.value);
  return (
    <>
      <div class="free-ribbon" aria-label="100% Free, no sign-up, no card required">
        <span>{ui.freeRibbon}</span>
      </div>
      <header class="top-bar">
        <div class="brand-row">
          <a class="brand-lockup" href="/" aria-label="ResumePDF">
            <span class="brand-name">Resume<span>PDF</span></span>
          </a>
          <SaveIndicator />
        </div>
        <div class="top-actions">
          <button class="import-btn" type="button" onClick={onImport} aria-label="Import CV">
            <svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M2 15h10"/>
              <polyline points="9 12 12 15 9 18"/>
            </svg>
            <span class="btn-text">{ui.importBtn}</span>
          </button>
          <button class="export-btn" type="button" aria-label="Download CV as PDF" onClick={() => {
            track('export', {
              template: template.value,
              sections_visible_count: Object.values(visibility.value).filter(Boolean).length,
              ai_used: wasAIUsed(),
            });
            void downloadPDF();
          }}>
            <svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span class="btn-text">Download</span>
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
