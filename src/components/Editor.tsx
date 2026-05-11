import { cv, setPersonal, visibility, toggleSection, textDir, setTextDir, cvLang } from '../state/store';
import { getUI } from '../i18n/sections';
import { SECTIONS,
  emptyEntry, emptyProject, emptyVolunteer, emptyConference,
  emptyCertification, emptyAward, emptyPublication, emptyLanguage, emptyReference,
} from '../state/defaults';
import { Section } from './Section';
import { EntryRepeater } from './EntryRepeater';

function PersonalField<K extends keyof typeof cv.value.personal>({
  id, label, type = 'text',
}: { id: K; label: string; type?: 'text' | 'email' | 'tel' }) {
  const value = String(cv.value.personal[id] ?? '');
  return (
    <div class="f f-float">
      <input
        type={type}
        dir="auto"
        value={value}
        placeholder=" "
        aria-label={label}
        onInput={(e) => setPersonal(id, (e.currentTarget as HTMLInputElement).value as never)}
      />
      <label>{label}</label>
    </div>
  );
}

function TextareaField({ id, label, rows = 3 }: {
  id: keyof typeof cv.value.personal; label: string; rows?: number;
}) {
  return (
    <div class="f f-float">
      <textarea
        rows={rows}
        dir="auto"
        value={String(cv.value.personal[id] ?? '')}
        placeholder=" "
        aria-label={label}
        onInput={(e) => setPersonal(id, (e.currentTarget as HTMLTextAreaElement).value as never)}
      />
      <label>{label}</label>
    </div>
  );
}

export function Editor() {
  const ui = getUI(cvLang.value);

  return (
    <>
      <Section title={ui.sectionsToShow}>
        <div class="vis-grid">
          {SECTIONS.map((s) => (
            <label class="vis-item" key={s.k}>
              <input
                type="checkbox"
                checked={visibility.value[s.k]}
                onChange={() => toggleSection(s.k)}
              />
              {s.l}
            </label>
          ))}
        </div>
        <div class="dir-row">
          <span class="dir-lbl">{ui.textDirectionLabel}</span>
          <div class="dir-seg">
            <button
              type="button"
              class={`dir-btn${textDir.value === 'ltr' ? ' active' : ''}`}
              onClick={() => setTextDir('ltr')}
              title="Left-to-right (English, Hindi, Chinese…)"
            >LTR</button>
            <button
              type="button"
              class={`dir-btn${textDir.value === 'rtl' ? ' active' : ''}`}
              onClick={() => setTextDir('rtl')}
              title="Right-to-left (Arabic, Hebrew…)"
            >RTL</button>
          </div>
        </div>
      </Section>

      <Section title={ui.personalInfo} open>
        <PersonalField id="name"  label={ui.fullName} />
        <PersonalField id="title" label={ui.professionalTitle} />
        <div class="field-row">
          <PersonalField id="dob" label={ui.dateOfBirth} />
          <PersonalField id="nationality" label={ui.nationality} />
        </div>
        <div class="field-row">
          <PersonalField id="gender" label={ui.gender} />
          <PersonalField id="marital" label={ui.maritalStatus} />
        </div>
        <PersonalField id="location" label={ui.addressLocation} />
        <div class="field-row">
          <PersonalField id="email" label={ui.emailField} type="email" />
          <PersonalField id="phone" label={ui.phoneField} type="tel" />
        </div>
        <div class="field-row">
          <PersonalField id="linkedin" label={ui.linkedinField} />
          <PersonalField id="github"   label={ui.githubField} />
        </div>
        <div class="field-row">
          <PersonalField id="website" label={ui.websiteField} />
          <PersonalField id="twitter" label={ui.twitterField} />
        </div>
      </Section>

      <Section title={ui.profileSummaryPanel}>
        <TextareaField id="summary" label={ui.summaryField} rows={4} />
      </Section>

      <Section title={ui.careerObjectivePanel}>
        <TextareaField id="objective" label={ui.objectiveField} rows={3} />
      </Section>

      <Section title={ui.workExperiencePanel}>
        <EntryRepeater
          collection="experience"
          addLabel={ui.addPosition}
          empty={emptyEntry}
          titleField="title"
          fields={[
            { key: 'title', label: ui.titlePosition },
            { key: 'org', label: ui.companyOrg },
            { key: 'location', label: ui.locationField },
            { key: 'date', label: ui.dateRangeField },
            { key: 'desc', label: ui.achievementsField, type: 'textarea', full: true },
            { key: 'url', label: ui.websiteUrlField },
          ]}
        />
      </Section>

      <Section title={ui.educationPanel}>
        <EntryRepeater
          collection="education"
          addLabel={ui.addEducation}
          empty={emptyEntry}
          titleField="title"
          fields={[
            { key: 'title', label: ui.degreeQual },
            { key: 'org', label: ui.institution },
            { key: 'location', label: ui.locationField },
            { key: 'date', label: ui.dateRangeField },
            { key: 'desc', label: ui.detailsGpa, type: 'textarea', full: true },
            { key: 'url', label: ui.websiteUrlField },
          ]}
        />
      </Section>

      <Section title={ui.skillsPanel}>
        <TextareaField id="skillsTech"  label={ui.techSkillsField} rows={2} />
        <TextareaField id="skillsSoft"  label={ui.softSkillsField} rows={2} />
        <TextareaField id="skillsTools" label={ui.toolsField} rows={2} />
      </Section>

      <Section title={ui.languagesPanel}>
        <EntryRepeater
          collection="languages"
          addLabel={ui.addLanguage}
          empty={emptyLanguage}
          titleField="name"
          fields={[
            { key: 'name', label: ui.langName },
            { key: 'level', label: ui.proficiencyLevel },
          ]}
        />
      </Section>

      <Section title={ui.certsPanel}>
        <EntryRepeater
          collection="certifications"
          addLabel={ui.addCertification}
          empty={emptyCertification}
          titleField="title"
          fields={[
            { key: 'title', label: ui.certName },
            { key: 'issuer', label: ui.issuingOrg },
            { key: 'date', label: ui.dateIssuedField },
            { key: 'id', label: ui.credentialId },
            { key: 'url', label: ui.verifyUrl },
          ]}
        />
      </Section>

      <Section title={ui.projectsPanel}>
        <EntryRepeater
          collection="projects"
          addLabel={ui.addProject}
          empty={emptyProject}
          titleField="title"
          fields={[
            { key: 'title', label: ui.projectTitle },
            { key: 'role', label: ui.yourRole },
            { key: 'date', label: ui.dateRangeField },
            { key: 'desc', label: ui.descriptionField, type: 'textarea', full: true },
            { key: 'url', label: ui.urlLinkField },
          ]}
        />
      </Section>

      <Section title={ui.awardsPanel}>
        <EntryRepeater
          collection="awards"
          addLabel={ui.addAward}
          empty={emptyAward}
          titleField="title"
          fields={[
            { key: 'title', label: ui.awardTitle },
            { key: 'issuer', label: ui.issuingBody },
            { key: 'date', label: ui.dateField },
            { key: 'desc', label: ui.descriptionField, type: 'textarea', full: true },
          ]}
        />
      </Section>

      <Section title={ui.pubsPanel}>
        <EntryRepeater
          collection="publications"
          addLabel={ui.addPublication}
          empty={emptyPublication}
          titleField="title"
          fields={[
            { key: 'authors', label: ui.authorsField },
            { key: 'title', label: ui.titleOfWork },
            { key: 'venue', label: ui.journalVenue },
            { key: 'date', label: ui.dateYearField },
            { key: 'url', label: ui.urlDoiField },
          ]}
        />
      </Section>

      <Section title={ui.confPanel}>
        <EntryRepeater
          collection="conferences"
          addLabel={ui.addTalk}
          empty={emptyConference}
          titleField="title"
          fields={[
            { key: 'title', label: ui.talkTitle },
            { key: 'org', label: ui.eventConference },
            { key: 'location', label: ui.locationField },
            { key: 'date', label: ui.dateField },
            { key: 'desc', label: ui.descriptionField, type: 'textarea', full: true },
          ]}
        />
      </Section>

      <Section title={ui.volunteerPanel}>
        <EntryRepeater
          collection="volunteer"
          addLabel={ui.addVolunteer}
          empty={emptyVolunteer}
          titleField="title"
          fields={[
            { key: 'title', label: ui.roleField },
            { key: 'org', label: ui.orgField },
            { key: 'location', label: ui.locationField },
            { key: 'date', label: ui.dateRangeField },
            { key: 'desc', label: ui.descriptionField, type: 'textarea', full: true },
          ]}
        />
      </Section>

      <Section title={ui.interestsPanel}>
        <TextareaField id="interests" label={ui.interestsField} rows={2} />
      </Section>

      <Section title={ui.refsPanel}>
        <EntryRepeater
          collection="references"
          addLabel={ui.addReference}
          empty={emptyReference}
          titleField="name"
          fields={[
            { key: 'name', label: ui.refName },
            { key: 'title', label: ui.refTitleOrg },
            { key: 'email', label: ui.refEmail, type: 'email' },
            { key: 'phone', label: ui.refPhone, type: 'tel' },
          ]}
        />
      </Section>
    </>
  );
}
