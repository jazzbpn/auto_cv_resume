import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { extractText } from '../services/pdfText';
import { importCVText, type ImportedCV } from '../services/aiClient';
import { track } from '../services/analytics';
import { replaceCV, cvLang } from '../state/store';
import type { CV } from '../types';
import { showToast } from './Toast';
import { getUI } from '../i18n/sections';

type Stage = 'idle' | 'processing' | 'success' | 'error';
const stage = signal<Stage>('idle');
const progress = signal(0);
const progressTitle = signal('Reading your CV…');
const progressSub = signal('Preparing your content');
const errorMsg = signal('');
const parsed = signal<ImportedCV | null>(null);
const sourceName = signal('');
const pasteText = signal('');

function setProgress(pct: number, title?: string, sub?: string) {
  progress.value = pct;
  if (title) progressTitle.value = title;
  if (sub) progressSub.value = sub;
}

function importFormat(source: string): string {
  if (source === 'pasted text') return 'pasted';
  const ext = source.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1];
  return ext ?? 'unknown';
}

async function runImport(text: string, source: string) {
  const ui = getUI(cvLang.value);
  if (!text || text.trim().length < 50) {
    stage.value = 'error';
    errorMsg.value = ui.importErrTooShort;
    track('import_error', { stage: 'too_short' });
    return;
  }
  stage.value = 'processing';
  setProgress(10, ui.importProgressReading, 'Preparing your content');
  try {
    setProgress(30, ui.importProgressAnalysing, 'Identifying sections and entries');
    const result = await importCVText(text);
    setProgress(85, ui.importProgressExtracting, 'Mapping fields to your editor');
    parsed.value = result;
    sourceName.value = source;
    setProgress(100, ui.importProgressDone, '');
    stage.value = 'success';
    track('import_success', { format: importFormat(source) });
  } catch (e) {
    stage.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : ui.importErrParse;
    track('import_error', { stage: 'parse' });
  }
}

async function handleFile(file: File) {
  try {
    const text = await extractText(file);
    if (!text || text.length < 30) throw new Error('Could not extract text. Try pasting it directly.');
    await runImport(text, file.name);
  } catch (e) {
    stage.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : getUI(cvLang.value).importErrRead;
    track('import_error', { stage: 'extract' });
  }
}

const s = (v: unknown): string => (typeof v === 'string' ? v : '');

function fillEntry(e: Partial<CV['experience'][number]>): CV['experience'][number] {
  return { title: s(e.title), org: s(e.org), location: s(e.location), date: s(e.date), desc: s(e.desc), url: s(e.url) };
}
function fillProject(e: Partial<CV['projects'][number]>): CV['projects'][number] {
  return { title: s(e.title), role: s(e.role), date: s(e.date), desc: s(e.desc), url: s(e.url) };
}
function fillVolunteer(e: Partial<CV['volunteer'][number]>): CV['volunteer'][number] {
  return { title: s(e.title), org: s(e.org), location: s(e.location), date: s(e.date), desc: s(e.desc) };
}
function fillConference(e: Partial<CV['conferences'][number]>): CV['conferences'][number] {
  return { title: s(e.title), org: s(e.org), location: s(e.location), date: s(e.date), desc: s(e.desc) };
}
function fillCert(e: Partial<CV['certifications'][number]>): CV['certifications'][number] {
  return { title: s(e.title), issuer: s(e.issuer), date: s(e.date), id: s(e.id), url: s(e.url) };
}
function fillAward(e: Partial<CV['awards'][number]>): CV['awards'][number] {
  return { title: s(e.title), issuer: s(e.issuer), date: s(e.date), desc: s(e.desc) };
}
function fillPub(e: Partial<CV['publications'][number]>): CV['publications'][number] {
  return { authors: s(e.authors), title: s(e.title), venue: s(e.venue), date: s(e.date), url: s(e.url) };
}
function fillLang(e: Partial<CV['languages'][number]>): CV['languages'][number] {
  return { name: s(e.name), level: s(e.level) };
}
function fillRef(e: Partial<CV['references'][number]>): CV['references'][number] {
  return { name: s(e.name), title: s(e.title), email: s(e.email), phone: s(e.phone) };
}

function buildCVFromImport(p: ImportedCV): CV {
  return {
    personal: {
      name: s(p.name), title: s(p.title),
      email: s(p.email), phone: s(p.phone), location: s(p.location),
      linkedin: s(p.linkedin), github: s(p.github), website: s(p.website), twitter: s(p.twitter),
      dob: s(p.dob), nationality: s(p.nationality), gender: s(p.gender), marital: s(p.marital),
      summary: s(p.summary), objective: s(p.objective),
      skillsTech: s(p.skills_tech), skillsSoft: s(p.skills_soft), skillsTools: s(p.skills_tools),
      interests: s(p.interests),
    },
    experience: (p.experience ?? []).map(fillEntry).filter(e => e.title || e.org),
    education: (p.education ?? []).map(fillEntry).filter(e => e.title || e.org),
    languages: (p.languages ?? []).map(fillLang).filter(l => l.name),
    certifications: (p.certifications ?? []).map(fillCert).filter(c => c.title),
    projects: (p.projects ?? []).map(fillProject).filter(pr => pr.title),
    awards: (p.awards ?? []).map(fillAward).filter(a => a.title),
    publications: (p.publications ?? []).map(fillPub).filter(pub => pub.title),
    conferences: (p.conferences ?? []).map(fillConference).filter(c => c.title),
    volunteer: (p.volunteer ?? []).map(fillVolunteer).filter(v => v.title),
    references: (p.references ?? []).map(fillRef).filter(r => r.name),
  };
}

function applyImport(p: ImportedCV) {
  replaceCV(buildCVFromImport(p));
  showToast(getUI(cvLang.value).importToast);
}

interface Props { onClose: () => void }

export function ImportModal({ onClose }: Props) {
  const ui = getUI(cvLang.value);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stage.value = 'idle';
    progress.value = 0;
    parsed.value = null;
    pasteText.value = '';
    errorMsg.value = '';
  }, []);

  const onBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.add('drag-over');
  };
  const onDragLeave = () => dropRef.current?.classList.remove('drag-over');
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file) void handleFile(file);
  };

  return (
    <div class="import-modal" role="dialog" aria-modal="true" onClick={onBackdrop}>
      <div class="import-modal-box" onClick={(e) => e.stopPropagation()}>
        <header class="import-modal-hd">
          <span class="import-modal-title">{ui.importModalTitle}</span>
          <button type="button" class="import-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
            </svg>
          </button>
        </header>

        {stage.value === 'idle' && (
          <>
            <div
              ref={dropRef}
              class="import-dropzone"
              onClick={() => fileRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <div class="import-drop-icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 15V3m0 0L8 7m4-4 4 4"/>
                  <path d="M3 15v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/>
                </svg>
              </div>
              <div class="import-drop-title">{ui.importDropTitle}</div>
              <div class="import-drop-sub">{ui.importDropSub}</div>
              <div class="import-drop-formats">{ui.importDropFormats}</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              onChange={(e) => {
                const f = (e.currentTarget as HTMLInputElement).files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <div class="import-or-row"><span>{ui.importOrPaste}</span></div>
            <textarea
              class="import-paste-area"
              rows={8}
              value={pasteText.value}
              onInput={(e) => { pasteText.value = (e.currentTarget as HTMLTextAreaElement).value; }}
              placeholder={ui.importPastePlaceholder}
            />
            <button
              class="import-go-btn"
              type="button"
              onClick={() => { void runImport(pasteText.value, 'pasted text'); }}
            >
              {ui.importAnalyseBtn}
            </button>
          </>
        )}

        {stage.value === 'processing' && (
          <div class="import-progress-wrap">
            <div class="import-spinner-large" aria-hidden>✦</div>
            <div class="import-progress-title">{progressTitle.value}</div>
            <div class="import-progress-sub">{progressSub.value}</div>
            <div class="import-progress-bar-bg">
              <div class="import-progress-bar-fill" style={`width:${progress.value}%`} />
            </div>
          </div>
        )}

        {stage.value === 'success' && parsed.value && (() => {
          const cleaned = buildCVFromImport(parsed.value);
          const expN = cleaned.experience.length;
          const eduN = cleaned.education.length;
          const skillN = [cleaned.personal.skillsTech, cleaned.personal.skillsSoft, cleaned.personal.skillsTools]
            .join(',').split(',').map(t => t.trim()).filter(Boolean).length;
          return (
          <div class="import-success-wrap">
            <div class="import-success-icon" aria-hidden>✓</div>
            <div class="import-success-title">{ui.importSuccessTitle}</div>
            <div class="import-success-sub">
              Extracted from {sourceName.value}: {expN} job{expN === 1 ? '' : 's'},{' '}
              {eduN} education entr{eduN === 1 ? 'y' : 'ies'}, {skillN} skill{skillN === 1 ? '' : 's'}.
            </div>
            <div class="import-preview-fields">
              {parsed.value.name && <FieldRow l="Name"  v={parsed.value.name} />}
              {parsed.value.title && <FieldRow l="Title" v={parsed.value.title} />}
              {parsed.value.email && <FieldRow l="Email" v={parsed.value.email} />}
              {parsed.value.phone && <FieldRow l="Phone" v={parsed.value.phone} />}
              {parsed.value.location && <FieldRow l="Location" v={parsed.value.location} />}
              {parsed.value.summary && <FieldRow l="Summary" v={parsed.value.summary.slice(0, 120) + '…'} />}
            </div>
            <button
              class="import-go-btn"
              type="button"
              onClick={() => { applyImport(parsed.value!); onClose(); }}
            >
              {ui.importApplyBtn}
            </button>
            <button class="import-cancel-btn" type="button" onClick={onClose}>{ui.importCancelBtn}</button>
          </div>
          );
        })()}

        {stage.value === 'error' && (
          <div class="import-error-wrap">
            <div class="import-error-icon" aria-hidden>⚠</div>
            <div class="import-error-title">{ui.importErrorTitle}</div>
            <div class="import-error-msg">{errorMsg.value}</div>
            <button class="import-go-btn" type="button" onClick={() => { stage.value = 'idle'; }}>{ui.importTryAgainBtn}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({ l, v }: { l: string; v: string }) {
  return (
    <div class="import-field-row">
      <span class="import-field-lbl">{l}</span>
      <span class="import-field-val">{v}</span>
    </div>
  );
}
