import './modern.css';
import type { ResumeData } from './derive';
import { expWithOverrides } from './derive';
import {
  EntryBlock, CertBlock, AwardBlock, PubBlock, RefGrid,
} from './shared';

export function Modern({ data }: { data: ResumeData }) {
  const { cv, visibility: vis, contacts, personalDetails,
    techSkills, softSkills, toolSkills, interests, summaryOverride } = data;
  const p = cv.personal;
  const summary = summaryOverride ?? p.summary;
  const exp = expWithOverrides(data);
  const allSkills = techSkills.length + softSkills.length + toolSkills.length;

  return (
    <article class="resume modern">
      <aside class="mod-left">
        <div class="mod-name">{p.name}</div>
        <div class="mod-jtitle">{p.title}</div>

        <div class="mod-stitle">Contact</div>
        {contacts.map((c, i) => (
          <div class="mod-ci" key={i}>
            {c.kind === 'link' ? <a href={c.href}>{c.text}</a> : c.text}
          </div>
        ))}

        {personalDetails.length > 0 && (
          <>
            <div class="mod-stitle">Personal</div>
            {personalDetails.map((d, i) => (
              <div class="mod-ci" key={i}><b>{d.l}:</b> {d.v}</div>
            ))}
          </>
        )}

        {vis.skills && allSkills > 0 && (
          <>
            {techSkills.length > 0 && (
              <>
                <div class="mod-stitle">Technical</div>
                {techSkills.map((s) => (
                  <div key={s}>
                    <div class="mod-sl">{s}</div>
                    <div class="mod-sb"><div class="mod-sf" /></div>
                  </div>
                ))}
              </>
            )}
            {softSkills.length > 0 && (
              <>
                <div class="mod-stitle">Soft Skills</div>
                {softSkills.map((s) => <div class="mod-li" key={s}>{s}</div>)}
              </>
            )}
            {toolSkills.length > 0 && (
              <>
                <div class="mod-stitle">Tools</div>
                {toolSkills.map((s) => <div class="mod-li" key={s}>{s}</div>)}
              </>
            )}
          </>
        )}

        {vis.languages && cv.languages.length > 0 && (
          <>
            <div class="mod-stitle">Languages</div>
            {cv.languages.map((l, i) => (
              <div class="lang-item" key={i}>
                <span>{l.name}</span>
                <span class="lang-lvl">{l.level}</span>
              </div>
            ))}
          </>
        )}

        {vis.interests && interests.length > 0 && (
          <>
            <div class="mod-stitle">Interests</div>
            {interests.map((it, i) => <div class="mod-li" key={i}>{it}</div>)}
          </>
        )}
      </aside>

      <div class="mod-right">
        {vis.objective && p.objective && (
          <>
            <h2 class="r-stitle">Career Objective</h2>
            <div class="r-summary">{p.objective}</div>
          </>
        )}
        {vis.summary && summary && (
          <>
            <h2 class="r-stitle">Profile</h2>
            <div class="r-summary">{summary}</div>
          </>
        )}
        {vis.experience && exp.length > 0 && (
          <>
            <h2 class="r-stitle">Experience</h2>
            {exp.map((e, i) => <EntryBlock e={e} key={i} />)}
          </>
        )}
        {vis.education && cv.education.length > 0 && (
          <>
            <h2 class="r-stitle">Education</h2>
            {cv.education.map((e, i) => <EntryBlock e={e} key={i} />)}
          </>
        )}
        {vis.certs && cv.certifications.length > 0 && (
          <>
            <h2 class="r-stitle">Certifications</h2>
            {cv.certifications.map((c, i) => <CertBlock c={c} key={i} />)}
          </>
        )}
        {vis.projects && cv.projects.length > 0 && (
          <>
            <h2 class="r-stitle">Projects</h2>
            {cv.projects.map((e, i) => <EntryBlock e={e} key={i} />)}
          </>
        )}
        {vis.awards && cv.awards.length > 0 && (
          <>
            <h2 class="r-stitle">Awards & Honors</h2>
            {cv.awards.map((a, i) => <AwardBlock a={a} key={i} />)}
          </>
        )}
        {vis.pubs && cv.publications.length > 0 && (
          <>
            <h2 class="r-stitle">Publications</h2>
            {cv.publications.map((pub, i) => <PubBlock p={pub} key={i} />)}
          </>
        )}
        {vis.conf && cv.conferences.length > 0 && (
          <>
            <h2 class="r-stitle">Conferences & Speaking</h2>
            {cv.conferences.map((c, i) => <EntryBlock e={c} key={i} />)}
          </>
        )}
        {vis.volunteer && cv.volunteer.length > 0 && (
          <>
            <h2 class="r-stitle">Volunteer</h2>
            {cv.volunteer.map((v, i) => <EntryBlock e={v} key={i} />)}
          </>
        )}
        {vis.references && (
          <>
            <h2 class="r-stitle">References</h2>
            {cv.references.length === 0
              ? <em class="ref-available">Available upon request.</em>
              : <RefGrid items={cv.references} />}
          </>
        )}
      </div>
    </article>
  );
}
