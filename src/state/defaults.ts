import type { CV, SectionKey, TemplateId } from '../types';

export const SECTIONS: { k: SectionKey; l: string }[] = [
  { k: 'objective', l: 'Objective' },
  { k: 'summary', l: 'Summary' },
  { k: 'experience', l: 'Experience' },
  { k: 'education', l: 'Education' },
  { k: 'skills', l: 'Skills' },
  { k: 'languages', l: 'Languages' },
  { k: 'certs', l: 'Certifications' },
  { k: 'projects', l: 'Projects' },
  { k: 'awards', l: 'Awards' },
  { k: 'pubs', l: 'Publications' },
  { k: 'conf', l: 'Conferences' },
  { k: 'volunteer', l: 'Volunteer' },
  { k: 'interests', l: 'Interests' },
  { k: 'references', l: 'References' },
];

export const DEFAULT_TEMPLATE: TemplateId = 'classic';

export const DEFAULT_VISIBILITY: Record<SectionKey, boolean> = {
  objective: true, summary: true, experience: true, education: true,
  skills: true, languages: true, certs: true, projects: true,
  awards: true, pubs: true, conf: true, volunteer: true,
  interests: true, references: true,
};

export const DEFAULT_CV: CV = {
  personal: {
    name: 'James Professor',
    title: 'Senior Product Designer',
    email: 'alex@beaumont.io',
    phone: '+1 (415) 882-0044',
    location: 'San Francisco, CA 94102',
    linkedin: '',
    github: '',
    website: 'beaumont.io',
    twitter: '',
    dob: '',
    nationality: '',
    gender: '',
    marital: '',
    summary: 'Award-winning designer bridging research and craft — building products people return to by choice, not habit. 8+ years delivering human-centred experiences across fintech, healthcare, and enterprise SaaS.',
    objective: '',
    skillsTech: 'Figma, Sketch, Adobe XD, Prototyping, Design Systems, HTML/CSS',
    skillsSoft: 'Team Leadership, Stakeholder Management, Strategic Thinking, Mentoring',
    skillsTools: 'Jira, Notion, Miro, Hotjar, Amplitude, React',
    interests: 'Documentary Photography, Jazz Piano, Rock Climbing, Open-source Design',
  },
  experience: [
    { title: 'Lead Product Designer', org: 'Meridian Labs', location: 'San Francisco, CA', date: 'Jan 2021 – Present', desc: 'Directed end-to-end design for a SaaS platform serving 200k+ users. Managed a 5-person design team. Reduced onboarding drop-off by 34% through iterative, research-led redesign.', url: '' },
    { title: 'UX Designer', org: 'Folio Studio', location: 'New York, NY', date: 'Jun 2018 – Dec 2020', desc: 'Designed mobile-first experiences for fintech and healthcare clients. Delivered 12 major product launches across iOS and Android.', url: '' },
  ],
  education: [
    { title: 'BFA Interaction Design', org: 'California College of the Arts', location: 'San Francisco, CA', date: '2014 – 2018', desc: "Graduated with distinction. Thesis: Designing for Ambient Legibility. Dean's List 2016–2018.", url: '' },
  ],
  projects: [
    { title: 'Aria Design System', role: 'Lead Designer', date: '2022 – 2023', desc: 'Enterprise-scale design system adopted by 40+ product teams. Reduced handoff time by 60%.', url: 'aria-ds.beaumont.io' },
  ],
  volunteer: [
    { title: 'UX Mentor', org: 'ADPList', location: 'Remote', date: '2021 – Present', desc: 'Monthly 1:1 mentoring with early-career designers globally.' },
  ],
  conferences: [
    { title: 'Keynote: "Designing for the Edges"', org: 'UX London 2023', location: 'London, UK', date: 'May 2023', desc: 'Presented to 800+ attendees.' },
  ],
  certifications: [
    { title: 'Google UX Design Certificate', issuer: 'Google / Coursera', date: '2022', id: 'CERT-GUX-2022', url: '' },
  ],
  awards: [
    { title: 'Awwwards Site of the Day', issuer: 'Awwwards', date: '2023', desc: 'Meridian Labs homepage redesign.' },
  ],
  publications: [
    { authors: 'Beaumont, A.', title: 'Designing for Trust: UX Patterns in Fintech', venue: 'UX Collective', date: '2023', url: '' },
  ],
  languages: [
    { name: 'English', level: 'Native' },
    { name: 'French', level: 'Professional Proficiency' },
  ],
  references: [
    { name: 'Sarah Mitchell', title: 'VP of Product, Meridian Labs', email: 's.mitchell@meridian.io', phone: '+1 (415) 200-1234' },
  ],
};

export function emptyEntry(): import('../types').Entry {
  return { title: '', org: '', location: '', date: '', desc: '', url: '' };
}
export function emptyProject(): import('../types').Project {
  return { title: '', role: '', date: '', desc: '', url: '' };
}
export function emptyVolunteer(): import('../types').Volunteer {
  return { title: '', org: '', location: '', date: '', desc: '' };
}
export function emptyConference(): import('../types').Conference {
  return { title: '', org: '', location: '', date: '', desc: '' };
}
export function emptyCertification(): import('../types').Certification {
  return { title: '', issuer: '', date: '', id: '', url: '' };
}
export function emptyAward(): import('../types').Award {
  return { title: '', issuer: '', date: '', desc: '' };
}
export function emptyPublication(): import('../types').Publication {
  return { authors: '', title: '', venue: '', date: '', url: '' };
}
export function emptyLanguage(): import('../types').Language {
  return { name: '', level: '' };
}
export function emptyReference(): import('../types').Reference {
  return { name: '', title: '', email: '', phone: '' };
}
