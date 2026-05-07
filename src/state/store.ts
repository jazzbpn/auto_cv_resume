import { signal, computed, effect } from '@preact/signals';
import type { CV, SectionKey, TemplateId, AIResult, CollectionKey } from '../types';
import { DEFAULT_CV, DEFAULT_TEMPLATE, DEFAULT_VISIBILITY } from './defaults';

const STORAGE_KEY = 'cv-builder.v1';

interface Persisted {
  cv: CV;
  template: TemplateId;
  visibility: Record<SectionKey, boolean>;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { cv: DEFAULT_CV, template: DEFAULT_TEMPLATE, visibility: DEFAULT_VISIBILITY };
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      cv: p.cv ?? DEFAULT_CV,
      template: p.template ?? DEFAULT_TEMPLATE,
      visibility: { ...DEFAULT_VISIBILITY, ...(p.visibility ?? {}) },
    };
  } catch {
    return { cv: DEFAULT_CV, template: DEFAULT_TEMPLATE, visibility: DEFAULT_VISIBILITY };
  }
}

const initial = load();

export const cv = signal<CV>(initial.cv);
export const template = signal<TemplateId>(initial.template);
export const visibility = signal<Record<SectionKey, boolean>>(initial.visibility);
export const aiResult = signal<AIResult | null>(null);
/** Snapshot of cv taken right before applyAIFix mutates it; null when no AI fix is in effect. */
export const aiSnapshot = signal<CV | null>(null);

export type SaveStatus = 'saved' | 'saving' | 'error';
export const saveStatus = signal<SaveStatus>('saved');
/** UNIX ms of the last successful localStorage write; null until first save. */
export const lastSavedAt = signal<number | null>(null);

let saveTimer: number | undefined;
let firstRun = true;
effect(() => {
  const snapshot: Persisted = { cv: cv.value, template: template.value, visibility: visibility.value };
  // Skip flagging the very first effect run as "saving" — it's just init.
  if (firstRun) { firstRun = false; return; }
  saveStatus.value = 'saving';
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      saveStatus.value = 'saved';
      lastSavedAt.value = Date.now();
    } catch {
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

export function setAllSections(value: boolean) {
  const next = {} as Record<SectionKey, boolean>;
  for (const k of Object.keys(visibility.value) as SectionKey[]) next[k] = value;
  visibility.value = next;
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
 * snapshotting the previous CV so it can be restored.
 */
export function applyAIFix() {
  const r = aiResult.value;
  if (!r) return;
  const before = cv.value;
  const next: CV = {
    ...before,
    personal: {
      ...before.personal,
      summary: r.optimized_summary || before.personal.summary,
    },
    experience: before.experience.map((e, i) => {
      const o = r.optimized_experience.find(x => x.index === i);
      return o?.optimized_desc ? { ...e, desc: o.optimized_desc } : e;
    }),
  };
  aiSnapshot.value = before;
  cv.value = next;
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
