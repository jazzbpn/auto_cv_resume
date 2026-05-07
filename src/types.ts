export type TemplateId = 'classic' | 'modern' | 'minimal';

export type SectionKey =
  | 'objective' | 'summary'
  | 'experience' | 'education'
  | 'skills' | 'languages'
  | 'certs' | 'projects'
  | 'awards' | 'pubs'
  | 'conf' | 'volunteer'
  | 'interests' | 'references';

export interface Personal {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
  twitter: string;
  dob: string;
  nationality: string;
  gender: string;
  marital: string;
  summary: string;
  objective: string;
  skillsTech: string;
  skillsSoft: string;
  skillsTools: string;
  interests: string;
  refMode: 'available' | 'listed';
}

export interface Entry {
  title: string;
  org: string;
  location: string;
  date: string;
  desc: string;
  url: string;
}

export interface Project {
  title: string;
  role: string;
  date: string;
  desc: string;
  url: string;
}

export interface Volunteer {
  title: string;
  org: string;
  location: string;
  date: string;
  desc: string;
}

export interface Conference {
  title: string;
  org: string;
  location: string;
  date: string;
  desc: string;
}

export interface Certification {
  title: string;
  issuer: string;
  date: string;
  id: string;
  url: string;
}

export interface Award {
  title: string;
  issuer: string;
  date: string;
  desc: string;
}

export interface Publication {
  authors: string;
  title: string;
  venue: string;
  date: string;
  url: string;
}

export interface Language {
  name: string;
  level: string;
}

export interface Reference {
  name: string;
  title: string;
  email: string;
  phone: string;
}

export interface CV {
  personal: Personal;
  experience: Entry[];
  education: Entry[];
  projects: Project[];
  volunteer: Volunteer[];
  conferences: Conference[];
  certifications: Certification[];
  awards: Award[];
  publications: Publication[];
  languages: Language[];
  references: Reference[];
}

export type CollectionKey =
  | 'experience' | 'education' | 'projects' | 'volunteer' | 'conferences'
  | 'certifications' | 'awards' | 'publications' | 'languages' | 'references';

export interface AIIssue {
  category: 'Issues' | 'Formatting' | 'Keywords' | 'Content' | 'Impact';
  severity: 'critical' | 'warning' | 'tip';
  title: string;
  description: string;
  fix: string;
}

export interface AIResult {
  /** Score of the CV as currently written. */
  ats_score: number;
  /** Estimated score after applying optimized_summary + optimized_experience. */
  optimized_ats_score: number;
  score_label: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  summary: string;
  issues: AIIssue[];
  keywords_present: string[];
  keywords_missing: string[];
  optimized_summary: string;
  optimized_experience: { index: number; optimized_desc: string }[];
  quick_wins: string[];
}
