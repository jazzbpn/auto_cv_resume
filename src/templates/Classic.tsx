import './classic.css';
import './classic.rtl.css';
import { textDir, cvLang } from '../state/store';
import { getT } from '../i18n/sections';
import type { ResumeData } from './derive';
import { expWithOverrides } from './derive';
import {
  ContactRow, PersonalDetails, EntryBlock, CertBlock,
  AwardBlock, PubBlock, LangList, RefGrid, SkillTags,
} from './shared';

export function Classic({ data }: { data: ResumeData }) {
  const { cv, visibility: vis, contacts, personalDetails,
    techSkills, softSkills, toolSkills, interests, summaryOverride } = data;
  const p = cv.personal;
  const summary = summaryOverride ?? p.summary;
  const exp = expWithOverrides(data);
  const allSkills = techSkills.length + softSkills.length + toolSkills.length;
  const t = getT(cvLang.value);

  return (
    <article class="resume classic" dir={textDir.value}>
      <div class="r-header">
        <div class="r-header-info">
          <h1 class="r-name">{p.name}</h1>
          <div class="r-jtitle">{p.title}</div>
        </div>
        {data.showPhoto && data.photo && (
          <img src={data.photo} alt="" class="r-photo" aria-hidden="true" />
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
          {exp.map((e, i) => <EntryBlock e={e} key={i} />)}
        </section>
      )}

      {vis.education && cv.education.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.education}</h2>
          {cv.education.map((e, i) => <EntryBlock e={e} key={i} />)}
        </section>
      )}

      {vis.skills && allSkills > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.skills}</h2>
          {techSkills.length > 0 && (
            <div class="skill-group">
              <div class="skill-cat">{t.skillsTech}</div>
              <SkillTags items={techSkills} />
            </div>
          )}
          {softSkills.length > 0 && (
            <div class="skill-group">
              <div class="skill-cat">{t.skillsSoft}</div>
              <SkillTags items={softSkills} />
            </div>
          )}
          {toolSkills.length > 0 && (
            <div class="skill-group">
              <div class="skill-cat">{t.skillsTools}</div>
              <SkillTags items={toolSkills} />
            </div>
          )}
        </section>
      )}

      {vis.languages && cv.languages.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.languages}</h2>
          <div class="r-two"><LangList items={cv.languages} /></div>
        </section>
      )}

      {vis.certs && cv.certifications.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.certs}</h2>
          {cv.certifications.map((c, i) => <CertBlock c={c} key={i} />)}
        </section>
      )}

      {vis.projects && cv.projects.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.projects}</h2>
          {cv.projects.map((e, i) => <EntryBlock e={e} key={i} />)}
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
          {cv.conferences.map((c, i) => <EntryBlock e={c} key={i} />)}
        </section>
      )}

      {vis.volunteer && cv.volunteer.length > 0 && (
        <section class="r-sec">
          <h2 class="r-stitle">{t.volunteer}</h2>
          {cv.volunteer.map((v, i) => <EntryBlock e={v} key={i} />)}
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
