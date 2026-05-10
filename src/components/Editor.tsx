import { cv, setPersonal, visibility, toggleSection } from '../state/store';
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
  return (
    <>
      <Section title="Sections to Show">
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
      </Section>

      <Section title="👤 Personal Info" open>
        <PersonalField id="name"  label="Full Name" />
        <PersonalField id="title" label="Professional Title" />
        <div class="field-row">
          <PersonalField id="dob" label="Date of Birth" />
          <PersonalField id="nationality" label="Nationality" />
        </div>
        <div class="field-row">
          <PersonalField id="gender" label="Gender" />
          <PersonalField id="marital" label="Marital Status" />
        </div>
        <PersonalField id="location" label="Address / Location" />
        <div class="field-row">
          <PersonalField id="email" label="Email" type="email" />
          <PersonalField id="phone" label="Phone" type="tel" />
        </div>
        <div class="field-row">
          <PersonalField id="linkedin" label="LinkedIn" />
          <PersonalField id="github"   label="GitHub" />
        </div>
        <div class="field-row">
          <PersonalField id="website" label="Website" />
          <PersonalField id="twitter" label="Twitter / X" />
        </div>
      </Section>

      <Section title="📝 Profile / Summary">
        <TextareaField id="summary" label="Summary" rows={4} />
      </Section>

      <Section title="🎯 Career Objective">
        <TextareaField id="objective" label="Objective Statement" rows={3} />
      </Section>

      <Section title="💼 Work Experience">
        <EntryRepeater
          collection="experience"
          addLabel="Add Position"
          empty={emptyEntry}
          titleField="title"
          fields={[
            { key: 'title', label: 'Title / Position' },
            { key: 'org', label: 'Company / Organization' },
            { key: 'location', label: 'Location' },
            { key: 'date', label: 'Date Range' },
            { key: 'desc', label: 'Achievements & Responsibilities', type: 'textarea', full: true },
            { key: 'url', label: 'Website / URL' },
          ]}
        />
      </Section>

      <Section title="🎓 Education">
        <EntryRepeater
          collection="education"
          addLabel="Add Education"
          empty={emptyEntry}
          titleField="title"
          fields={[
            { key: 'title', label: 'Degree / Qualification' },
            { key: 'org', label: 'Institution' },
            { key: 'location', label: 'Location' },
            { key: 'date', label: 'Date Range' },
            { key: 'desc', label: 'Details (GPA, thesis, honours)', type: 'textarea', full: true },
            { key: 'url', label: 'Website / URL' },
          ]}
        />
      </Section>

      <Section title="⚡ Skills">
        <TextareaField id="skillsTech"  label="Technical Skills (comma-separated)" rows={2} />
        <TextareaField id="skillsSoft"  label="Soft Skills (comma-separated)" rows={2} />
        <TextareaField id="skillsTools" label="Tools & Software (comma-separated)" rows={2} />
      </Section>

      <Section title="🌐 Languages">
        <EntryRepeater
          collection="languages"
          addLabel="Add Language"
          empty={emptyLanguage}
          titleField="name"
          fields={[
            { key: 'name', label: 'Language' },
            { key: 'level', label: 'Proficiency Level' },
          ]}
        />
      </Section>

      <Section title="🏅 Certifications & Licenses">
        <EntryRepeater
          collection="certifications"
          addLabel="Add Certification"
          empty={emptyCertification}
          titleField="title"
          fields={[
            { key: 'title', label: 'Certification Name' },
            { key: 'issuer', label: 'Issuing Organization' },
            { key: 'date', label: 'Date Issued' },
            { key: 'id', label: 'Credential ID' },
            { key: 'url', label: 'Verify URL' },
          ]}
        />
      </Section>

      <Section title="🚀 Projects">
        <EntryRepeater
          collection="projects"
          addLabel="Add Project"
          empty={emptyProject}
          titleField="title"
          fields={[
            { key: 'title', label: 'Project Title' },
            { key: 'role', label: 'Your Role' },
            { key: 'date', label: 'Date Range' },
            { key: 'desc', label: 'Description', type: 'textarea', full: true },
            { key: 'url', label: 'URL / Link' },
          ]}
        />
      </Section>

      <Section title="🏆 Awards & Honors">
        <EntryRepeater
          collection="awards"
          addLabel="Add Award"
          empty={emptyAward}
          titleField="title"
          fields={[
            { key: 'title', label: 'Award Title' },
            { key: 'issuer', label: 'Issuing Body' },
            { key: 'date', label: 'Date' },
            { key: 'desc', label: 'Description', type: 'textarea', full: true },
          ]}
        />
      </Section>

      <Section title="📚 Publications & Research">
        <EntryRepeater
          collection="publications"
          addLabel="Add Publication"
          empty={emptyPublication}
          titleField="title"
          fields={[
            { key: 'authors', label: 'Author(s)' },
            { key: 'title', label: 'Title of Work' },
            { key: 'venue', label: 'Journal / Publisher / Venue' },
            { key: 'date', label: 'Date / Year' },
            { key: 'url', label: 'URL / DOI' },
          ]}
        />
      </Section>

      <Section title="🎤 Conferences & Speaking">
        <EntryRepeater
          collection="conferences"
          addLabel="Add Talk / Conference"
          empty={emptyConference}
          titleField="title"
          fields={[
            { key: 'title', label: 'Talk / Session Title' },
            { key: 'org', label: 'Event / Conference' },
            { key: 'location', label: 'Location' },
            { key: 'date', label: 'Date' },
            { key: 'desc', label: 'Description', type: 'textarea', full: true },
          ]}
        />
      </Section>

      <Section title="🤝 Volunteer Work">
        <EntryRepeater
          collection="volunteer"
          addLabel="Add Volunteer Role"
          empty={emptyVolunteer}
          titleField="title"
          fields={[
            { key: 'title', label: 'Role' },
            { key: 'org', label: 'Organization' },
            { key: 'location', label: 'Location' },
            { key: 'date', label: 'Date Range' },
            { key: 'desc', label: 'Description', type: 'textarea', full: true },
          ]}
        />
      </Section>

      <Section title="✨ Interests & Hobbies">
        <TextareaField id="interests" label="Interests (comma-separated)" rows={2} />
      </Section>

      <Section title="📋 References">
        <div class="f f-float">
          <select
            class="form-select"
            aria-label="Display Mode"
            value={cv.value.personal.refMode}
            onChange={(e) =>
              setPersonal('refMode', (e.currentTarget as HTMLSelectElement).value as 'available' | 'listed')
            }
          >
            <option value="available">Available upon request</option>
            <option value="listed">List references</option>
          </select>
          <label>Display Mode</label>
        </div>
        <EntryRepeater
          collection="references"
          addLabel="Add Reference"
          empty={emptyReference}
          titleField="name"
          fields={[
            { key: 'name', label: 'Full Name' },
            { key: 'title', label: 'Title & Organization' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'phone', label: 'Phone', type: 'tel' },
          ]}
        />
      </Section>
    </>
  );
}
