import type {
  Entry, Project, Volunteer, Conference, Certification,
  Award, Publication, Language, Reference,
} from '../types';
import { cvLang } from '../state/store';
import { getT } from '../i18n/sections';

export interface Contact { kind: 'link' | 'text'; href?: string; text: string }

export function ContactRow({ items }: { items: Contact[] }) {
  return (
    <div class="r-contacts">
      {items.map((c, i) => (
        <span key={i}>
          {c.kind === 'link'
            ? <a href={c.href}><bdi>{c.text}</bdi></a>
            : <bdi>{c.text}</bdi>}
        </span>
      ))}
    </div>
  );
}

export function PersonalDetails({ rows }: { rows: { l: string; v: string }[] }) {
  if (!rows.length) return null;
  const t = getT(cvLang.value);
  return (
    <div class="r-sec">
      <div class="r-stitle">{t.personalDetails}</div>
      {rows.map((d, i) => (
        <div class="pdet-row" key={i}>
          <span class="pdet-lbl">{d.l}</span>
          <span>{d.v}</span>
        </div>
      ))}
    </div>
  );
}

export function EntryBlock({ e }: { e: Entry | Project | Volunteer | Conference }) {
  const role = (e as Project).role;
  return (
    <div class="r-entry">
      <div class="r-ehead">
        <div class="r-etitle">{e.title}</div>
        <div class="r-edate"><bdi>{e.date}</bdi></div>
      </div>
      {('org' in e && e.org)
        ? <div class="r-esub">{e.org}{role ? ` · ${role}` : ''}</div>
        : (role && <div class="r-esub">{role}</div>)}
      {'location' in e && e.location && <div class="r-eloc">📍 {e.location}</div>}
      {e.desc && <div class="r-edesc">{e.desc}</div>}
      {'url' in e && e.url && <div class="r-eurl">🔗 <bdi>{e.url}</bdi></div>}
    </div>
  );
}

export function CertBlock({ c }: { c: Certification }) {
  return (
    <div class="cert-item">
      <div class="cert-head">
        <div class="cert-title">{c.title}</div>
        <div class="r-edate"><bdi>{c.date}</bdi></div>
      </div>
      {c.issuer && <div class="r-esub">{c.issuer}</div>}
      {c.id && <div class="r-eloc">ID: <bdi>{c.id}</bdi></div>}
      {c.url && <div class="r-eurl">🔗 <bdi>{c.url}</bdi></div>}
    </div>
  );
}

export function AwardBlock({ a }: { a: Award }) {
  return (
    <div class="award-item">
      <div class="award-title">
        {a.title}{a.date && <span class="award-date"> <bdi>{a.date}</bdi></span>}
      </div>
      {a.issuer && <div class="award-body">{a.issuer}</div>}
      {a.desc && <div class="award-body award-desc">{a.desc}</div>}
    </div>
  );
}

export function PubBlock({ p }: { p: Publication }) {
  return (
    <div class="pub-item">
      {p.authors && <span class="pub-authors">{p.authors} </span>}
      <em>"{p.title}"</em>{p.venue && ` — ${p.venue}`}{p.date && `, `}{p.date && <bdi>{p.date}</bdi>}
      {p.url && <div class="r-eurl">🔗 <bdi>{p.url}</bdi></div>}
    </div>
  );
}

export function LangList({ items }: { items: Language[] }) {
  return (
    <>
      {items.map((l, i) => (
        <div class="lang-item" key={i}>
          <span>{l.name}</span>
          <span class="lang-lvl">{l.level}</span>
        </div>
      ))}
    </>
  );
}

export function RefGrid({ items }: { items: Reference[] }) {
  return (
    <div class="ref-grid">
      {items.map((r, i) => (
        <div class="ref-item" key={i}>
          <div class="ref-name">{r.name}</div>
          <div class="ref-det">{r.title}</div>
          <div class="ref-det">{r.email}</div>
          <div class="ref-det">{r.phone}</div>
        </div>
      ))}
    </div>
  );
}

export function SkillTags({ items }: { items: string[] }) {
  return (
    <div class="skill-wrap">
      {items.map((s, i) => <span class="skill-tag" key={i}>{s}</span>)}
    </div>
  );
}
