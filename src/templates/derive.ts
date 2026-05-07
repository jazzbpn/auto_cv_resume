import type { CV, SectionKey } from '../types';
import type { Contact } from './shared';
import { splitCSV } from '../state/store';

export interface ResumeData {
  cv: CV;
  visibility: Record<SectionKey, boolean>;
  contacts: Contact[];
  personalDetails: { l: string; v: string }[];
  techSkills: string[];
  softSkills: string[];
  toolSkills: string[];
  interests: string[];
  /** When set, overrides the personal summary (used by AI preview). */
  summaryOverride?: string;
  /** When set, overrides desc on experience entries by index. */
  expOverrides?: Map<number, string>;
}

export function buildResumeData(
  cv: CV,
  visibility: Record<SectionKey, boolean>,
  opts: { summaryOverride?: string; expOverrides?: Map<number, string> } = {},
): ResumeData {
  const p = cv.personal;
  const contacts: Contact[] = [];
  if (p.email)    contacts.push({ kind: 'link', href: `mailto:${p.email}`, text: p.email });
  if (p.phone)    contacts.push({ kind: 'text', text: p.phone });
  if (p.location) contacts.push({ kind: 'text', text: p.location });
  if (p.linkedin) contacts.push({ kind: 'link', href: `https://${p.linkedin}`, text: p.linkedin });
  if (p.github)   contacts.push({ kind: 'link', href: `https://${p.github}`, text: p.github });
  if (p.website)  contacts.push({ kind: 'link', href: `https://${p.website}`, text: p.website });
  if (p.twitter)  contacts.push({ kind: 'text', text: p.twitter });

  const personalDetails: { l: string; v: string }[] = [];
  if (p.dob) personalDetails.push({ l: 'Date of Birth', v: p.dob });
  if (p.nationality) personalDetails.push({ l: 'Nationality', v: p.nationality });
  if (p.gender) personalDetails.push({ l: 'Gender', v: p.gender });
  if (p.marital) personalDetails.push({ l: 'Marital Status', v: p.marital });

  return {
    cv,
    visibility,
    contacts,
    personalDetails,
    techSkills: splitCSV(p.skillsTech),
    softSkills: splitCSV(p.skillsSoft),
    toolSkills: splitCSV(p.skillsTools),
    interests: splitCSV(p.interests),
    ...(opts.summaryOverride !== undefined ? { summaryOverride: opts.summaryOverride } : {}),
    ...(opts.expOverrides !== undefined ? { expOverrides: opts.expOverrides } : {}),
  };
}

export function expWithOverrides(data: ResumeData) {
  if (!data.expOverrides) return data.cv.experience;
  return data.cv.experience.map((e, i) => {
    const o = data.expOverrides!.get(i);
    return o ? { ...e, desc: o } : e;
  });
}
