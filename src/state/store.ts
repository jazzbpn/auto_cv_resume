import { signal, computed, effect } from '@preact/signals';
import type { CV, SectionKey, TemplateId, AIResult, AIOptimize, CollectionKey } from '../types';
import { type LangCode, LANG_META } from '../i18n/sections';
import { DEFAULT_CV, DEFAULT_TEMPLATE, DEFAULT_VISIBILITY } from './defaults';
import { idbGet, idbPut, requestPersistentStorage } from '../services/idb';

const STORAGE_KEY = 'cv-builder.v1';
const IDB_KEY = 'app-state-v1';

interface Persisted {
  cv: CV;
  template: TemplateId;
  visibility: Record<SectionKey, boolean>;
  textDir: 'ltr' | 'rtl';
  cvLang: LangCode;
}

/**
 * Synchronous read from localStorage so the first paint shows the user's
 * data without a flicker. IndexedDB hydration runs asynchronously after
 * boot and replaces these signals if the IDB record is present (canonical).
 * For a fresh user with no localStorage yet, this returns defaults; the
 * subsequent IDB hydrate then writes the (possibly imported) data back.
 */
function loadSync(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { cv: DEFAULT_CV, template: DEFAULT_TEMPLATE, visibility: DEFAULT_VISIBILITY, textDir: 'ltr', cvLang: 'en' };
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      cv: p.cv ?? DEFAULT_CV,
      template: p.template ?? DEFAULT_TEMPLATE,
      visibility: { ...DEFAULT_VISIBILITY, ...(p.visibility ?? {}) },
      textDir: p.textDir ?? 'ltr',
      cvLang: p.cvLang ?? 'en',
    };
  } catch {
    return { cv: DEFAULT_CV, template: DEFAULT_TEMPLATE, visibility: DEFAULT_VISIBILITY, textDir: 'ltr', cvLang: 'en' };
  }
}

const initial = loadSync();

export const cv = signal<CV>(initial.cv);
export const template = signal<TemplateId>(initial.template);
export const visibility = signal<Record<SectionKey, boolean>>(initial.visibility);
export const textDir = signal<'ltr' | 'rtl'>(initial.textDir);
export function setTextDir(d: 'ltr' | 'rtl') { textDir.value = d; }

export const cvLang = signal<LangCode>(initial.cvLang);
export function setCvLang(lang: LangCode) {
  cvLang.value = lang;
  textDir.value = LANG_META[lang].dir;
}
export const aiResult = signal<AIResult | null>(null);
/**
 * Result of the secondary "optimize" call (rewrites + projected score).
 * Fetched in the background after aiResult lands so the panel paints fast.
 * Read by HeroScore (for the "Potential" preview) and by applyAIFix.
 */
export const aiOptimize = signal<AIOptimize | null>(null);
/** Snapshot of cv taken right before applyAIFix mutates it; null when no AI fix is in effect. */
export const aiSnapshot = signal<CV | null>(null);

export type SaveStatus = 'saved' | 'saving' | 'error';
export const saveStatus = signal<SaveStatus>('saved');
/** UNIX ms of the last successful save; null until first save. */
export const lastSavedAt = signal<number | null>(null);

/**
 * Hydrate from IndexedDB after first paint. IDB is the canonical store —
 * if it has data, it overrides whatever we synchronously read from
 * localStorage. localStorage is kept as a fast-cache and migration bridge.
 *
 * `hydrating` blocks the auto-save effect from firing during this phase
 * (otherwise the synchronous initial values would be flushed back to
 * storage as if the user had typed them).
 */
let hydrating = true;
async function hydrate(): Promise<void> {
  try {
    const persisted = await idbGet<Persisted>(IDB_KEY);
    if (persisted) {
      if (persisted.cv) cv.value = persisted.cv;
      if (persisted.template) template.value = persisted.template;
      if (persisted.visibility) {
        visibility.value = { ...DEFAULT_VISIBILITY, ...persisted.visibility };
      }
      if (persisted.textDir) textDir.value = persisted.textDir;
      if (persisted.cvLang) cvLang.value = persisted.cvLang;
    } else {
      // No IDB record yet — likely a returning user with localStorage data,
      // or a brand-new visitor. Either way, write current signal state to
      // IDB so the next boot reads the canonical store.
      await idbPut(IDB_KEY, {
        cv: cv.value,
        template: template.value,
        visibility: visibility.value,
        textDir: textDir.value,
        cvLang: cvLang.value,
      } satisfies Persisted);
    }
  } finally {
    hydrating = false;
  }
}

void hydrate();
void requestPersistentStorage();

let saveTimer: number | undefined;
let firstRun = true;
effect(() => {
  const snapshot: Persisted = { cv: cv.value, template: template.value, visibility: visibility.value, textDir: textDir.value, cvLang: cvLang.value };
  // Skip flagging the very first effect run as "saving" — it's just init.
  if (firstRun) { firstRun = false; return; }
  // Don't write back the synchronous defaults on top of IDB during hydration.
  if (hydrating) return;
  saveStatus.value = 'saving';
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    let ok = false;
    // Canonical: IndexedDB.
    ok = await idbPut(IDB_KEY, snapshot);
    // Fast cache + fallback for browsers/contexts where IDB fails.
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); ok = true; }
    catch { /* keep ok from IDB */ }
    if (ok) {
      saveStatus.value = 'saved';
      lastSavedAt.value = Date.now();
    } else {
      saveStatus.value = 'error';
    }
  }, 250);
});

export function setPersonal<K extends keyof CV['personal']>(key: K, value: CV['personal'][K]) {
  cv.value = { ...cv.value, personal: { ...cv.value.personal, [key]: value } };
}

export function setTemplate(t: TemplateId) { template.value = t; }

export function toggleSection(k: SectionKey) {
  visibility.value = { ...visibility.value, [k]: !visibility.value[k] };
}

export function addItem<K extends CollectionKey>(key: K, item: CV[K][number]) {
  cv.value = { ...cv.value, [key]: [...cv.value[key], item] } as CV;
}

export function removeItem<K extends CollectionKey>(key: K, index: number) {
  const next = cv.value[key].filter((_, i) => i !== index);
  cv.value = { ...cv.value, [key]: next } as CV;
}

export function updateItem<K extends CollectionKey>(
  key: K, index: number, field: keyof CV[K][number], value: string,
) {
  const next = cv.value[key].map((row, i) =>
    i === index ? { ...row, [field]: value } : row,
  );
  cv.value = { ...cv.value, [key]: next } as CV;
}

export function replaceCV(next: CV) {
  cv.value = next;
  aiSnapshot.value = null;
}

/**
 * Write the AI's optimized summary + experience descriptions into the form,
 * snapshotting the previous CV so it can be restored. Returns `true` if any
 * rewrites were applied; `false` when the AI response had no usable
 * rewrites (e.g. truncated and the repair stripped them). The caller can
 * show a helpful message instead of a misleading "fixed" state.
 *
 * Note: we don't require the AI's summary to differ from the existing one
 * — for a strong CV, the AI may return the same text verbatim. We still
 * count that as "applied" so the user gets the projected score and the
 * state transition.
 */
export function applyAIFix(): boolean {
  const opt = aiOptimize.value;
  if (!opt) return false;

  const trimStr = (s: string | undefined | null) => (s ?? '').trim();
  const optSummary = trimStr(opt.optimized_summary);
  const optObjective = trimStr(opt.optimized_objective);
  const optSkillsTech = trimStr(opt.optimized_skills_tech);
  const optSkillsSoft = trimStr(opt.optimized_skills_soft);
  const optSkillsTools = trimStr(opt.optimized_skills_tools);
  const optExp = Array.isArray(opt.optimized_experience) ? opt.optimized_experience : [];
  const optEdu = Array.isArray(opt.optimized_education) ? opt.optimized_education : [];
  const optProj = Array.isArray(opt.optimized_projects) ? opt.optimized_projects : [];

  const anyListRewrite = (arr: { optimized_desc?: string }[]) =>
    arr.some(o => trimStr(o?.optimized_desc) !== '');

  const hasAnyRewrite =
    !!optSummary || !!optObjective ||
    !!optSkillsTech || !!optSkillsSoft || !!optSkillsTools ||
    anyListRewrite(optExp) || anyListRewrite(optEdu) || anyListRewrite(optProj);

  if (!hasAnyRewrite) {
    console.warn('[applyAIFix] AI response had no rewrites', opt);
    return false;
  }

  // For each list-section: only replace desc on entries the AI rewrote;
  // entries without a matching index keep their original text. Indexes are
  // matched against the entry's 0-based position in the source CV.
  const applyDescRewrites = <T extends { desc: string }>(
    items: T[], rewrites: { index: number; optimized_desc: string }[],
  ): T[] => items.map((e, i) => {
    const r = rewrites.find(x => x?.index === i);
    const desc = trimStr(r?.optimized_desc);
    return desc ? { ...e, desc } : e;
  });

  const before = cv.value;
  const next: CV = {
    ...before,
    personal: {
      ...before.personal,
      summary:     optSummary     || before.personal.summary,
      objective:   optObjective   || before.personal.objective,
      skillsTech:  optSkillsTech  || before.personal.skillsTech,
      skillsSoft:  optSkillsSoft  || before.personal.skillsSoft,
      skillsTools: optSkillsTools || before.personal.skillsTools,
    },
    experience: applyDescRewrites(before.experience, optExp),
    education:  applyDescRewrites(before.education,  optEdu),
    projects:   applyDescRewrites(before.projects,   optProj),
  };
  aiSnapshot.value = before;
  cv.value = next;
  return true;
}

/** Restore the form to its pre-fix state. No-op if no snapshot. */
export function undoAIFix() {
  const snap = aiSnapshot.value;
  if (!snap) return;
  cv.value = snap;
  aiSnapshot.value = null;
}

/**
 * Make the AI rewrites permanent: keep the current cv, drop the undo
 * snapshot. After this, further edits won't be lost to an accidental Undo.
 */
export function commitAIFix() {
  aiSnapshot.value = null;
}

export const contactItems = computed(() => {
  const p = cv.value.personal;
  const out: { kind: 'link' | 'text'; href?: string; text: string }[] = [];
  if (p.email)    out.push({ kind: 'link', href: `mailto:${p.email}`, text: p.email });
  if (p.phone)    out.push({ kind: 'text', text: p.phone });
  if (p.location) out.push({ kind: 'text', text: p.location });
  if (p.linkedin) out.push({ kind: 'link', href: `https://${p.linkedin}`, text: p.linkedin });
  if (p.github)   out.push({ kind: 'link', href: `https://${p.github}`, text: p.github });
  if (p.website)  out.push({ kind: 'link', href: `https://${p.website}`, text: p.website });
  if (p.twitter)  out.push({ kind: 'text', text: p.twitter });
  return out;
});

export function splitCSV(s: string): string[] {
  return s.split(',').map(x => x.trim()).filter(Boolean);
}
