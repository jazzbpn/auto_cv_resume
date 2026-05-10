import type { AIResult, AIOptimize, CV, SectionKey } from '../types';

/** Same-origin Pages Function: see functions/ai/chat.ts */
const AI_ENDPOINT = '/ai/chat';

const MODEL = 'deepseek-chat';

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'json_object' | 'text' };
  stream?: boolean;
}
interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

function describeStatus(status: number, upstreamMsg: string): string {
  switch (status) {
    case 401:
      return 'AI service rejected the API key. Verify DEEPSEEK_API_KEY in worker/.dev.vars is correct and active.';
    case 402:
      return 'DeepSeek account has insufficient balance. Top up at https://platform.deepseek.com/usage.';
    case 403:
      return 'AI service refused the request. Region or account restrictions may apply.';
    case 408:
    case 504:
      return 'AI service timed out. Try a shorter CV or try again in a moment.';
    case 429:
      return 'Too many requests. Wait a few seconds and try again.';
    case 500:
    case 502:
    case 503:
      return `AI service is temporarily unavailable${upstreamMsg ? `: ${upstreamMsg}` : ''}. Try again in a moment.`;
    default:
      return upstreamMsg || `AI service returned status ${status}.`;
  }
}

/**
 * Streaming variant of callProxy. Reads an SSE chat-completions stream
 * (OpenAI / DeepSeek format), accumulates the assistant's content deltas,
 * and invokes onChunk with the running accumulator on a throttle so the
 * UI can render progressively without re-rendering on every token.
 *
 * Returns the final accumulated content string once the stream ends.
 */
async function callProxyStream(
  body: ChatRequest,
  onChunk: (acc: string) => void,
): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }),
    });
  } catch (e) {
    throw new Error(
      'Could not reach the AI endpoint. In dev, run `npm run dev` (which starts wrangler pages dev).' +
      (e instanceof Error ? ` (${e.message})` : ''),
    );
  }

  if (!resp.ok) {
    const raw = await resp.text().catch(() => '');
    let upstreamMsg = '';
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } };
      upstreamMsg = j.error?.message ?? '';
    } catch { upstreamMsg = raw.slice(0, 200); }
    throw new Error(describeStatus(resp.status, upstreamMsg));
  }
  if (!resp.body) throw new Error('AI response had no body to stream.');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let acc = '';
  let lastEmitAt = 0;
  let lastEmitLen = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Process complete SSE lines; keep partial trailing line in buffer.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const obj = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
          error?: { message?: string };
        };
        if (obj.error?.message) throw new Error(obj.error.message);
        const delta = obj.choices?.[0]?.delta?.content ?? '';
        if (delta) acc += delta;
      } catch (e) {
        // A malformed SSE event isn't fatal — DeepSeek occasionally emits
        // pings or partial JSON; skip and keep going. But propagate explicit
        // upstream error payloads.
        if (e instanceof Error && e.message && !e.message.startsWith('Unexpected token')) {
          throw e;
        }
      }
    }
    // Throttle progress callbacks: at most every 150ms or every 240 chars
    // of new content. Keeps signal updates from thrashing on every token.
    const now = Date.now();
    if (acc.length > lastEmitLen && (now - lastEmitAt > 150 || acc.length - lastEmitLen > 240)) {
      lastEmitAt = now;
      lastEmitLen = acc.length;
      onChunk(acc);
    }
  }
  if (acc.length > lastEmitLen) onChunk(acc);
  if (!acc.trim()) throw new Error('AI returned an empty response. Try again.');
  return acc;
}

async function callProxy(body: ChatRequest): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(
      'Could not reach the AI endpoint. In dev, run `npm run dev` (which starts wrangler pages dev).' +
      (e instanceof Error ? ` (${e.message})` : ''),
    );
  }

  if (!resp.ok) {
    const raw = await resp.text().catch(() => '');
    let upstreamMsg = '';
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } };
      upstreamMsg = j.error?.message ?? '';
    } catch { upstreamMsg = raw.slice(0, 200); }
    throw new Error(describeStatus(resp.status, upstreamMsg));
  }

  let data: ChatResponse;
  try {
    data = (await resp.json()) as ChatResponse;
  } catch {
    throw new Error('AI response was not valid JSON.');
  }
  if (data.error) throw new Error(data.error.message || 'AI service error.');
  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error('AI returned an empty response. Try again.');
  return text;
}

/**
 * Walk a JSON-ish string and return a stack of unmatched openers ('{'/'['),
 * along with a flag for whether the string ended mid-quoted-value and the
 * position of the last "safe" cut point (right after a closed string, a
 * closed bracket, or a comma).
 */
function scanJSON(s: string): {
  stack: string[];
  inString: boolean;
  lastSafe: number;
} {
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  let lastSafe = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') {
      if (inString) { inString = false; lastSafe = i; }
      else inString = true;
      continue;
    }
    if (inString) continue;
    if (c === '{' || c === '[') {
      stack.push(c);
    } else if (c === '}' || c === ']') {
      stack.pop();
      lastSafe = i;
    } else if (c === ',') {
      lastSafe = i;
    }
  }
  return { stack, inString, lastSafe };
}

/**
 * Repair a truncated JSON object by closing open structures in the right
 * (reverse-nesting) order and trimming dangling keys / colons / commas.
 * Returns the input unchanged if it looks structurally complete.
 */
function repairTruncatedJSON(input: string): string {
  let s = input.trimEnd();
  let scan = scanJSON(s);
  // If we ended inside a string, lop the unfinished token off back to the
  // last safe delimiter (closing quote of the previous value, comma, or
  // close-bracket).
  if (scan.inString && scan.lastSafe >= 0) {
    s = s.slice(0, scan.lastSafe + 1);
    scan = scanJSON(s);
  }
  // Iteratively strip dangling tokens that would prevent a clean close:
  // trailing comma, trailing colon, and bare string tokens that look like
  // dangling keys (only inside an object — in an array a trailing string
  // is a complete value we want to keep).
  let prev: string;
  do {
    prev = s;
    s = s.replace(/,\s*$/, '');
    s = s.replace(/:\s*$/, '');
    const top = scanJSON(s).stack;
    const inObject = top.length > 0 && top[top.length - 1] === '{';
    if (inObject) s = s.replace(/"[^"\\]*"\s*$/, '');
  } while (s !== prev);
  // Re-scan after stripping so closes happen in the correct order.
  scan = scanJSON(s);
  let closer = '';
  while (scan.stack.length) {
    const opener = scan.stack.pop()!;
    closer += opener === '{' ? '}' : ']';
  }
  return s + closer;
}

function parseJSONFromText<T>(raw: string): T {
  const stripped = raw.trim().replace(/^```(?:json)?\n?|```$/g, '').trim();
  try { return JSON.parse(stripped) as T; } catch { /* fall through */ }
  // Slice from the first { to make the regex / repair tolerant of any
  // stray prose before the JSON.
  const start = stripped.indexOf('{');
  if (start < 0) {
    throw new Error(
      'AI did not return valid JSON. Tap Re-analyse to try again.',
    );
  }
  const candidate = stripped.slice(start);
  // Try the candidate as-is, then a brace-balancing repair for truncation.
  for (const attempt of [candidate, repairTruncatedJSON(candidate)]) {
    try { return JSON.parse(attempt) as T; } catch { /* try next */ }
  }
  throw new Error(
    'AI response was truncated mid-output. Tap Re-analyse to try again. If it keeps failing, your CV may have too many entries for one response.',
  );
}

const REVIEW_SYSTEM = `You are an elite ATS (Applicant Tracking System) expert and resume coach. Analyse the CV thoroughly across keywords, formatting, content depth, and impact statements. Respond with a single raw JSON object — no markdown, no prose, no extra fields.

Coverage requirements:
- "issues": 5-7 distinct issues spanning multiple categories — DO NOT cluster all in one category. Aim for at least 3 different "category" values across the list. Cap each "title" at 6 words; "description" and "fix" at one sentence each (≤ 18 words).
- "keywords_present": 8-12 ATS-relevant keywords / skills / technologies actually found in the CV.
- "keywords_missing": 8-12 ATS-relevant keywords / skills / technologies that are absent but would strengthen the CV (or match the job description if provided).
- "quick_wins": 3 concrete, immediately-actionable improvements (each ≤ 18 words).
- "summary": 2 short sentences — first names the strongest dimension, second names the biggest gap.

Categories to draw from: "Issues" (general), "Formatting" (layout, dates, lengths), "Keywords" (ATS terms), "Content" (depth, missing sections, empty visible fields), "Impact" (action verbs, quantification).
Severity: "critical" (blocking ATS rejection), "warning" (notably weakens score), "tip" (polish).

The CV input may include two NOTE blocks:
- Hidden sections: the user has deliberately removed these from their resume — DO NOT critique their absence, DO NOT recommend re-adding, DO NOT include their content in keyword analysis.
- Empty visible sections / fields / contacts: these ARE on the resume layout but contain no content yet. When filling one in would meaningfully improve the ATS score for the candidate's likely role, surface it as an "issue" (category Content) or "quick_win" with a concrete fix. Always treat the candidate's role context — don't, for example, recommend GitHub for a non-technical role.

Return this exact structure:
{
  "ats_score": <integer 0-100>,
  "score_label": <"Excellent"|"Good"|"Fair"|"Poor">,
  "summary": "",
  "issues": [{"category":"Issues|Formatting|Keywords|Content|Impact","severity":"critical|warning|tip","title":"","description":"","fix":""}],
  "keywords_present": [],
  "keywords_missing": [],
  "quick_wins": []
}`;

const OPTIMIZE_SYSTEM = `You are an elite ATS resume coach. Rewrite the user's text-heavy CV sections to maximise ATS impact. You MUST produce real rewrites — every CV can be improved with stronger keywords, sharper action verbs, and clearer quantified impact. Respond with a single raw JSON object — no markdown, no prose, no extra fields.

What to rewrite (MANDATORY when the source has content):
- "optimized_summary": ALWAYS rewrite if the CV has any summary OR work experience. 2-3 sentences, max ~60 words, dense with role-relevant ATS keywords.
- "optimized_experience": ALWAYS provide a rewrite for EVERY experience entry whose source desc is non-empty. Each "optimized_desc" is 3-4 bullets joined with \\n; each bullet starts with a strong action verb, ≤ 22 words, includes quantified impact where the source supports it.
- "optimized_education": rewrite each education entry whose source desc is non-empty (same bullet format as experience). Empty array only if no education entries have a desc.
- "optimized_projects": rewrite each project entry whose source desc is non-empty (same bullet format). Empty array only if no projects have a desc.

What may stay empty (only when the source field is itself empty):
- "optimized_objective": empty string "" if the CV has no objective field. Otherwise rewrite (1-2 sentences, ~40 words).
- "optimized_skills_tech" / "_soft" / "_tools": empty string "" only if the CV has no value in that field. Otherwise return a reordered/expanded comma-separated list with ATS keywords inferred from the candidate's experience. NEVER fabricate skills with no evidence in the CV.

"index" on experience/education/projects items MUST match the 0-based "[i]" tag in the source CV.
"optimized_ats_score" is your honest projection (0-100) AFTER applying these rewrites; MUST be >= the score the original CV would receive.

Return this exact structure:
{
  "optimized_ats_score": <integer 0-100>,
  "optimized_summary": "",
  "optimized_objective": "",
  "optimized_skills_tech": "",
  "optimized_skills_soft": "",
  "optimized_skills_tools": "",
  "optimized_experience": [{"index": 0, "optimized_desc": ""}],
  "optimized_education": [{"index": 0, "optimized_desc": ""}],
  "optimized_projects": [{"index": 0, "optimized_desc": ""}]
}`;

const IMPORT_SYSTEM = `You are an expert CV/resume parser. Extract ALL information from the provided CV/resume text and respond with a single JSON object — no markdown, no explanation, no backticks, just raw JSON.

Return this exact structure (use empty string "" for missing fields, empty arrays [] for missing lists):
{
  "name":"","title":"","email":"","phone":"","location":"",
  "linkedin":"","github":"","website":"","twitter":"",
  "dob":"","nationality":"","gender":"","marital":"",
  "summary":"","objective":"",
  "skills_tech":"","skills_soft":"","skills_tools":"","interests":"",
  "experience":[{"title":"","org":"","location":"","date":"","desc":"","url":""}],
  "education":[{"title":"","org":"","location":"","date":"","desc":"","url":""}],
  "languages":[{"name":"","level":""}],
  "certifications":[{"title":"","issuer":"","date":"","id":"","url":""}],
  "projects":[{"title":"","role":"","date":"","desc":"","url":""}],
  "awards":[{"title":"","issuer":"","date":"","desc":""}],
  "publications":[{"authors":"","title":"","venue":"","date":"","url":""}],
  "conferences":[{"title":"","org":"","location":"","date":"","desc":""}],
  "volunteer":[{"title":"","org":"","location":"","date":"","desc":""}],
  "references":[{"name":"","title":"","email":"","phone":""}]
}

Rules:
- skills_tech, skills_soft, skills_tools, interests: comma-separated strings
- Extract ALL work experience entries, ALL education entries
- Preserve exact dates as written
- Combine multi-line job descriptions into a single string with \\n separating bullets
- If a field is truly absent, use "" or []`;

/**
 * Serialise the CV to the text the AI sees. Sections the user has toggled
 * off in `visibility` are omitted entirely (they're not on the resume the
 * user is presenting), and a NOTE lists the hidden ones so the AI doesn't
 * flag them as "missing" or suggest adding them back.
 *
 * Personal info (name / title / contact / personal details) has no
 * visibility toggle and is always sent.
 */
export function cvToText(
  cv: CV,
  visibility: Record<SectionKey, boolean>,
): string {
  const p = cv.personal;
  const lines: string[] = [];
  const show = (k: SectionKey) => visibility[k] !== false;

  // Tell the AI which sections the user has deliberately hidden so it
  // doesn't critique their absence as a content gap.
  const hidden = (Object.keys(visibility) as SectionKey[]).filter(k => visibility[k] === false);
  if (hidden.length) {
    lines.push(
      `NOTE: The user has hidden these sections from their resume — do NOT analyse them, do NOT recommend adding them, do NOT include them in keyword analysis: ${hidden.join(', ')}`,
      '',
    );
  }

  lines.push(`NAME: ${p.name || '(not provided)'}`);
  if (p.title) lines.push(`TITLE: ${p.title}`);

  // Contact: include EVERY link the user filled in. Without this the AI
  // suggests "add LinkedIn" even when LinkedIn is already populated.
  const contact: string[] = [];
  if (p.email)    contact.push(`Email: ${p.email}`);
  if (p.phone)    contact.push(`Phone: ${p.phone}`);
  if (p.location) contact.push(`Location: ${p.location}`);
  if (p.linkedin) contact.push(`LinkedIn: ${p.linkedin}`);
  if (p.github)   contact.push(`GitHub: ${p.github}`);
  if (p.website)  contact.push(`Website: ${p.website}`);
  if (p.twitter)  contact.push(`Twitter: ${p.twitter}`);
  if (contact.length) lines.push(`CONTACT: ${contact.join(' | ')}`);

  const personalDetails: string[] = [];
  if (p.dob)         personalDetails.push(`DOB: ${p.dob}`);
  if (p.nationality) personalDetails.push(`Nationality: ${p.nationality}`);
  if (p.gender)      personalDetails.push(`Gender: ${p.gender}`);
  if (p.marital)     personalDetails.push(`Marital: ${p.marital}`);
  if (personalDetails.length) lines.push(`PERSONAL: ${personalDetails.join(' | ')}`);

  if (show('objective') && p.objective) lines.push('', `OBJECTIVE: ${p.objective}`);
  if (show('summary')   && p.summary)   lines.push('', `SUMMARY: ${p.summary}`);

  if (show('skills')) {
    if (p.skillsTech)  lines.push('', `TECHNICAL SKILLS: ${p.skillsTech}`);
    if (p.skillsSoft)  lines.push(`SOFT SKILLS: ${p.skillsSoft}`);
    if (p.skillsTools) lines.push(`TOOLS: ${p.skillsTools}`);
  }

  // The [i] tags align entries with the 0-based index Auto-Fix uses for
  // optimized_experience / _education / _projects rewrites.
  if (show('experience') && cv.experience.length) {
    lines.push('', 'WORK EXPERIENCE:');
    cv.experience.forEach((e, i) => {
      const meta = [e.date, e.location, e.url].filter(Boolean).join(' — ');
      lines.push(`  [${i}] ${e.title} at ${e.org}${meta ? ' (' + meta + ')' : ''}`);
      if (e.desc) lines.push(`  ${e.desc}`);
    });
  }
  if (show('education') && cv.education.length) {
    lines.push('', 'EDUCATION:');
    cv.education.forEach((e, i) => {
      const meta = [e.date, e.location, e.url].filter(Boolean).join(' — ');
      lines.push(`  [${i}] ${e.title}, ${e.org}${meta ? ' (' + meta + ')' : ''}`);
      if (e.desc) lines.push(`  ${e.desc}`);
    });
  }
  if (show('projects') && cv.projects.length) {
    lines.push('', 'PROJECTS:');
    cv.projects.forEach((proj, i) => {
      const meta = [proj.role, proj.date, proj.url].filter(Boolean).join(' — ');
      lines.push(`  [${i}] ${proj.title}${meta ? ' (' + meta + ')' : ''}`);
      if (proj.desc) lines.push(`  ${proj.desc}`);
    });
  }
  if (show('certs') && cv.certifications.length) {
    lines.push('', 'CERTIFICATIONS:');
    cv.certifications.forEach(c => {
      const tail = [c.date, c.id ? `ID: ${c.id}` : '', c.url].filter(Boolean).join(' — ');
      lines.push(`  ${c.title}, ${c.issuer}${tail ? ' (' + tail + ')' : ''}`);
    });
  }
  if (show('awards') && cv.awards.length) {
    lines.push('', 'AWARDS:');
    cv.awards.forEach(a => {
      lines.push(`  ${a.title}, ${a.issuer}${a.date ? ' (' + a.date + ')' : ''}`);
      if (a.desc) lines.push(`  ${a.desc}`);
    });
  }
  if (show('pubs') && cv.publications.length) {
    lines.push('', 'PUBLICATIONS:');
    cv.publications.forEach(pub => {
      const meta = [pub.venue, pub.date, pub.url].filter(Boolean).join(' — ');
      lines.push(`  ${pub.authors ? pub.authors + '. ' : ''}"${pub.title}"${meta ? ' (' + meta + ')' : ''}`);
    });
  }
  if (show('conf') && cv.conferences.length) {
    lines.push('', 'CONFERENCES & SPEAKING:');
    cv.conferences.forEach(c => {
      const meta = [c.date, c.location].filter(Boolean).join(' — ');
      lines.push(`  ${c.title} at ${c.org}${meta ? ' (' + meta + ')' : ''}`);
      if (c.desc) lines.push(`  ${c.desc}`);
    });
  }
  if (show('volunteer') && cv.volunteer.length) {
    lines.push('', 'VOLUNTEER:');
    cv.volunteer.forEach(v => {
      const meta = [v.date, v.location].filter(Boolean).join(' — ');
      lines.push(`  ${v.title} at ${v.org}${meta ? ' (' + meta + ')' : ''}`);
      if (v.desc) lines.push(`  ${v.desc}`);
    });
  }
  if (show('languages') && cv.languages.length) {
    lines.push('', 'LANGUAGES:');
    cv.languages.forEach(l => lines.push(`  ${l.name}${l.level ? ': ' + l.level : ''}`));
  }
  if (show('interests') && p.interests) lines.push('', `INTERESTS: ${p.interests}`);

  if (show('references')) {
    if (cv.references.length) {
      lines.push('', 'REFERENCES:');
      cv.references.forEach(r => {
        const meta = [r.email, r.phone].filter(Boolean).join(' | ');
        lines.push(`  ${r.name}, ${r.title}${meta ? ' — ' + meta : ''}`);
      });
    } else {
      lines.push('', 'REFERENCES: Available upon request');
    }
  }

  // Tell the AI which fields / sections are *visible but empty* — these
  // are gaps the user could close to improve their score. Hidden sections
  // are intentionally excluded (the user opted them out of the resume).
  // Personal-info fields like dob/nationality/gender/marital are NOT
  // listed: they're typically discouraged on modern resumes.
  const emptyContacts: string[] = [];
  if (!p.linkedin) emptyContacts.push('LinkedIn');
  if (!p.github)   emptyContacts.push('GitHub');
  if (!p.website)  emptyContacts.push('Website');

  const emptyFields: string[] = [];
  if (show('summary')   && !p.summary)     emptyFields.push('Summary');
  if (show('objective') && !p.objective)   emptyFields.push('Objective');
  if (show('skills')    && !p.skillsTech)  emptyFields.push('Technical Skills');
  if (show('skills')    && !p.skillsSoft)  emptyFields.push('Soft Skills');
  if (show('skills')    && !p.skillsTools) emptyFields.push('Tools');
  if (show('interests') && !p.interests)   emptyFields.push('Interests');

  const emptySections: string[] = [];
  if (show('experience')  && !cv.experience.length)     emptySections.push('Work Experience');
  if (show('education')   && !cv.education.length)      emptySections.push('Education');
  if (show('projects')    && !cv.projects.length)       emptySections.push('Projects');
  if (show('certs')       && !cv.certifications.length) emptySections.push('Certifications');
  if (show('awards')      && !cv.awards.length)         emptySections.push('Awards');
  if (show('pubs')        && !cv.publications.length)   emptySections.push('Publications');
  if (show('conf')        && !cv.conferences.length)    emptySections.push('Conferences');
  if (show('volunteer')   && !cv.volunteer.length)      emptySections.push('Volunteer');
  if (show('languages')   && !cv.languages.length)      emptySections.push('Languages');

  if (emptyContacts.length || emptyFields.length || emptySections.length) {
    lines.push(
      '',
      'NOTE — These are visible on the user\'s resume layout but have NO content yet. Suggest filling them in your analysis (as issues or quick_wins) when doing so would meaningfully improve the ATS score for this candidate\'s role. Do NOT recommend dob/nationality/gender/marital status fields:',
    );
    if (emptyContacts.length) lines.push(`  Empty contact links: ${emptyContacts.join(', ')}`);
    if (emptyFields.length)   lines.push(`  Empty text fields:   ${emptyFields.join(', ')}`);
    if (emptySections.length) lines.push(`  Empty sections:      ${emptySections.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Coerce a possibly-partial AI response into a fully-shaped AIResult so
 * downstream renderers (which assume arrays exist, scores are numbers, etc.)
 * don't throw on a truncated / weird response.
 */
function normalizeAIResult(p: unknown): AIResult {
  const o = (p ?? {}) as Record<string, unknown>;
  const num = (v: unknown, fallback = 0) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const str = (v: unknown, fallback = '') =>
    typeof v === 'string' ? v : fallback;
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const ats = num(o.ats_score);
  const labelRaw = str(o.score_label);
  const label: AIResult['score_label'] =
    labelRaw === 'Excellent' || labelRaw === 'Good' ||
    labelRaw === 'Fair' || labelRaw === 'Poor'
      ? labelRaw
      : (ats >= 80 ? 'Excellent' : ats >= 60 ? 'Good' : ats >= 40 ? 'Fair' : 'Poor');
  return {
    ats_score: ats,
    score_label: label,
    summary: str(o.summary),
    issues: arr<AIResult['issues'][number]>(o.issues),
    keywords_present: arr<string>(o.keywords_present),
    keywords_missing: arr<string>(o.keywords_missing),
    quick_wins: arr<string>(o.quick_wins),
  };
}

function normalizeAIOptimize(p: unknown, atsFloor: number): AIOptimize {
  const o = (p ?? {}) as Record<string, unknown>;
  const num = (v: unknown, fallback = 0) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const str = (v: unknown, fallback = '') =>
    typeof v === 'string' ? v : fallback;
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const opt = num(o.optimized_ats_score, atsFloor);
  type Rewrite = { index: number; optimized_desc: string };
  return {
    optimized_ats_score: opt < atsFloor ? atsFloor : opt,
    optimized_summary: str(o.optimized_summary),
    optimized_objective: str(o.optimized_objective),
    optimized_skills_tech: str(o.optimized_skills_tech),
    optimized_skills_soft: str(o.optimized_skills_soft),
    optimized_skills_tools: str(o.optimized_skills_tools),
    optimized_experience: arr<Rewrite>(o.optimized_experience),
    optimized_education: arr<Rewrite>(o.optimized_education),
    optimized_projects: arr<Rewrite>(o.optimized_projects),
  };
}

/**
 * Stream-aware progressive parse: try the accumulated content as JSON,
 * then again with the truncation-repair pass. Returns null if neither
 * produces a parseable object with a usable ats_score yet — caller waits
 * for more chunks. Used to surface the score in the UI within ~2s of the
 * AI starting to respond, instead of waiting for the full ~10-15s
 * generation to complete.
 */
function tryParseProgressive(acc: string): AIResult | null {
  if (!acc.trim()) return null;
  const stripped = acc.trim().replace(/^```(?:json)?\n?|```$/g, '').trim();
  const start = stripped.indexOf('{');
  if (start < 0) return null;
  const candidate = stripped.slice(start);
  for (const attempt of [candidate, repairTruncatedJSON(candidate)]) {
    try {
      const parsed = JSON.parse(attempt) as Record<string, unknown>;
      if (typeof parsed.ats_score === 'number' && Number.isFinite(parsed.ats_score)) {
        return normalizeAIResult(parsed);
      }
    } catch { /* try next */ }
  }
  return null;
}

export async function reviewCV(
  cv: CV,
  jobDescription: string,
  visibility: Record<SectionKey, boolean>,
  onPartial?: (partial: AIResult) => void,
): Promise<AIResult> {
  const cvText = cvToText(cv, visibility);
  const userMsg = jobDescription.trim()
    ? `JOB DESCRIPTION TO MATCH:\n${jobDescription}\n\n---\n\nMY CV:\n${cvText}`
    : `Please analyse this CV for general ATS optimisation (no specific job description provided):\n\n${cvText}`;
  const raw = await callProxyStream({
    model: MODEL,
    max_tokens: 2500,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: REVIEW_SYSTEM },
      { role: 'user', content: userMsg },
    ],
  }, (acc) => {
    if (!onPartial) return;
    const partial = tryParseProgressive(acc);
    if (partial) onPartial(partial);
  });
  const parsed = parseJSONFromText<unknown>(raw);
  const o = (parsed ?? {}) as Record<string, unknown>;
  // Reject responses that are missing the score entirely. parsing succeeded
  // but rendering would be useless without it — treat as a transient failure
  // so the user sees the "try again" banner instead of a blank panel.
  if (typeof o.ats_score !== 'number' || !Number.isFinite(o.ats_score)) {
    throw new Error(
      'AI response was incomplete (no score). Tap Re-analyse to try again.',
    );
  }
  return normalizeAIResult(parsed);
}

/**
 * Second-stage AI call: produce just the rewrites (summary + per-experience
 * descriptions). Runs in PARALLEL with reviewCV so total perceived time is
 * max(analyse, optimize) ≈ 12s instead of analyse + optimize ≈ 25s.
 *
 * Self-sufficient: doesn't depend on the analysis result, so the model
 * infers missing ATS keywords on its own. The render-time score clamp in
 * HeroScore (Math.max(baseScore, optimised)) enforces optimised >= base
 * when the two land out of order.
 *
 * Not streamed: this is a background prefetch and the UI doesn't render
 * anything from it until the full payload lands.
 */
export async function optimizeCV(
  cv: CV,
  jobDescription: string,
  visibility: Record<SectionKey, boolean>,
): Promise<AIOptimize> {
  const cvText = cvToText(cv, visibility);
  const userMsg = jobDescription.trim()
    ? `JOB DESCRIPTION:\n${jobDescription}\n\n---\n\nCV:\n${cvText}`
    : `CV:\n${cvText}`;
  const raw = await callProxy({
    model: MODEL,
    max_tokens: 4500,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: OPTIMIZE_SYSTEM },
      { role: 'user', content: userMsg },
    ],
  });
  const parsed = parseJSONFromText<unknown>(raw);
  return normalizeAIOptimize(parsed, 0);
}

export interface ImportedCV {
  name: string; title: string; email: string; phone: string; location: string;
  linkedin: string; github: string; website: string; twitter: string;
  dob: string; nationality: string; gender: string; marital: string;
  summary: string; objective: string;
  skills_tech: string; skills_soft: string; skills_tools: string; interests: string;
  experience: { title: string; org: string; location: string; date: string; desc: string; url: string }[];
  education: { title: string; org: string; location: string; date: string; desc: string; url: string }[];
  languages: { name: string; level: string }[];
  certifications: { title: string; issuer: string; date: string; id: string; url: string }[];
  projects: { title: string; role: string; date: string; desc: string; url: string }[];
  awards: { title: string; issuer: string; date: string; desc: string }[];
  publications: { authors: string; title: string; venue: string; date: string; url: string }[];
  conferences: { title: string; org: string; location: string; date: string; desc: string }[];
  volunteer: { title: string; org: string; location: string; date: string; desc: string }[];
  references: { name: string; title: string; email: string; phone: string }[];
}

export async function importCVText(text: string): Promise<ImportedCV> {
  const raw = await callProxy({
    model: MODEL,
    max_tokens: 8000,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: IMPORT_SYSTEM },
      { role: 'user', content: `Parse this CV/resume:\n\n${text.slice(0, 16000)}` },
    ],
  });
  return parseJSONFromText<ImportedCV>(raw);
}
