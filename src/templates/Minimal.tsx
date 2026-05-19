import './minimal.css';
import './minimal.rtl.css';
import { textDir, cvLang } from '../state/store';
import { getT } from '../i18n/sections';
import type { ResumeData } from './derive';
import { expWithOverrides } from './derive';
import {
  ContactRow, PersonalDetails, AwardBlock, PubBlock, LangList, RefGrid, SkillTags,
} from './shared';
import type { Entry, Project, Volunteer, Conference, Certification } from '../types';

function MinEntry({ e }: { e: Entry | Project | Volunteer | Conference }) {
  const role = (e as Project).role;
  return (
    <div class="r-entry">
      <div class="r-eleft">
        <div class="r-edate">{e.date}</div>
        {'org' in e && e.org && <em class="r-eorg">{e.org}</em>}
        {'location' in e && e.location && <div class="r-eloc-small">{e.location}</div>}
      </div>
      <div>
        <div class="r-etitle">{e.title}</div>
        {role && <div class="r-esub">{role}</div>}
        {e.desc && <div class="r-edesc">{e.desc}</div>}
        {'url' in e && e.url && <div class="r-eurl">🔗 {e.url}</div>}
      </div>
    </div>
  );
}

function MinCert({ c }: { c: Certification }) {
  return (
    <div class="cert-item">
      <div class="r-eleft">
        <div class="r-edate">{c.date}</div>
        {c.id && <div class="cert-id">ID: {c.id}</div>}
      </div>
      <div>
        <div class="cert-title">{c.title}</div>
        <div class="r-esub">{c.issuer}</div>
        {c.url && <div class="r-eurl">🔗 {c.url}</div>}
      </div>
    </div>
  );
}

export function Minimal({ data }: { data: ResumeData }) {
  const { cv, visibility: vis, contacts, personalDetails,
    techSkills, softSkills, toolSkills, interests, summaryOverride } = data;
  const p = cv.personal;
  const summary = summaryOverride ?? p.summary;
  const exp = expWithOverrides(data);
  const allSkills = techSkills.length + softSkills.length + toolSkills.length;
  const t = getT(cvLang.value);

  return (
    <article class="resume minimal" dir={textDir.value}>
      <div class="r-header-row">
        <div>
          <h1 class="r-name">{p.name}</h1>
          <div class="r-jtitle">{p.title}</div>
        </div>
        {data.showPhoto && data.photo && (
          <img src={data.photo} alt="" class="r-photo-sm" aria-hidden="true" />
        )}
      </div>
      <ContactRow items={contacts} />
      <PersonalDetails rows={personalDetails} />

      {vis.objective && p.objective && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.objective}</h2>
          <div class="r-summary">{p.objective}</div>
        </section>
      )}
      {vis.summary && summary && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.summary}</h2>
          <div class="r-summary">{summary}</div>
        </section>
      )}
      {vis.experience && exp.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.experience}</h2>
          {exp.map((e, i) => <MinEntry e={e} key={i} />)}
        </section>
      )}
      {vis.education && cv.education.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.education}</h2>
          {cv.education.map((e, i) => <MinEntry e={e} key={i} />)}
        </section>
      )}
      {vis.skills && allSkills > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.skills}</h2>
          {techSkills.length > 0 && (
            <div class="skill-row"><span class="skill-cat">{t.skillsTech} · </span><SkillTags items={techSkills} /></div>
          )}
          {softSkills.length > 0 && (
            <div class="skill-row"><span class="skill-cat">{t.skillsSoft} · </span><SkillTags items={softSkills} /></div>
          )}
          {toolSkills.length > 0 && (
            <div class="skill-row"><span class="skill-cat">{t.skillsTools} · </span><SkillTags items={toolSkills} /></div>
          )}
        </section>
      )}
      {vis.languages && cv.languages.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.languages}</h2>
          <LangList items={cv.languages} />
        </section>
      )}
      {vis.certs && cv.certifications.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.certs}</h2>
          {cv.certifications.map((c, i) => <MinCert c={c} key={i} />)}
        </section>
      )}
      {vis.projects && cv.projects.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.projects}</h2>
          {cv.projects.map((e, i) => <MinEntry e={e} key={i} />)}
        </section>
      )}
      {vis.awards && cv.awards.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.awards}</h2>
          {cv.awards.map((a, i) => <AwardBlock a={a} key={i} />)}
        </section>
      )}
      {vis.pubs && cv.publications.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.pubs}</h2>
          {cv.publications.map((pub, i) => <PubBlock p={pub} key={i} />)}
        </section>
      )}
      {vis.conf && cv.conferences.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.conf}</h2>
          {cv.conferences.map((c, i) => <MinEntry e={c} key={i} />)}
        </section>
      )}
      {vis.volunteer && cv.volunteer.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.volunteer}</h2>
          {cv.volunteer.map((v, i) => <MinEntry e={v} key={i} />)}
        </section>
      )}
      {vis.interests && interests.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.interests}</h2>
          <div class="interest-wrap">
            {interests.map((it, i) => <span key={i}>{it}</span>)}
          </div>
        </section>
      )}
      {vis.references && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.references}</h2>
          {cv.references.length === 0
            ? <em class="ref-available">{t.refAvailable}</em>
            : <RefGrid items={cv.references} />}
        </section>
      )}
    </article>
  );
}
