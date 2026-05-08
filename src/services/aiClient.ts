import type { AIResult, CV } from '../types';

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

const REVIEW_SYSTEM = `You are an elite ATS (Applicant Tracking System) expert and professional resume coach. Analyse the provided CV/resume and respond with a single JSON object — no markdown, no explanation, just raw JSON.

Return this exact structure:
{
  "ats_score": <integer 0-100, score of the CV as currently written>,
  "optimized_ats_score": <integer 0-100, projected score AFTER applying your optimized_summary and optimized_experience rewrites; this MUST be >= ats_score and should reflect the improvement honestly>,
  "score_label": <"Excellent"|"Good"|"Fair"|"Poor", label for the optimized_ats_score>,
  "summary": "<2-sentence overall assessment of the rewritten CV>",
  "issues": [{"category":"Issues|Formatting|Keywords|Content|Impact","severity":"critical|warning|tip","title":"","description":"","fix":""}],
  "keywords_present": [],
  "keywords_missing": [],
  "optimized_summary": "",
  "optimized_experience": [{"index":0,"optimized_desc":""}],
  "quick_wins": []
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

export function cvToText(cv: CV): string {
  const p = cv.personal;
  const lines = [`NAME: ${p.name}`, `TITLE: ${p.title}`];
  if (p.objective) lines.push(`OBJECTIVE: ${p.objective}`);
  if (p.summary) lines.push(`SUMMARY: ${p.summary}`);
  lines.push(`CONTACT: ${p.email} | ${p.phone} | ${p.location}`);
  if (p.skillsTech) lines.push(`TECHNICAL SKILLS: ${p.skillsTech}`);
  if (p.skillsSoft) lines.push(`SOFT SKILLS: ${p.skillsSoft}`);
  if (p.skillsTools) lines.push(`TOOLS: ${p.skillsTools}`);
  if (cv.experience.length) {
    lines.push('', 'WORK EXPERIENCE:');
    cv.experience.forEach(e =>
      lines.push(`  ${e.title} at ${e.org} (${e.date})${e.location ? ' — ' + e.location : ''}`, `  ${e.desc}`));
  }
  if (cv.education.length) {
    lines.push('', 'EDUCATION:');
    cv.education.forEach(e => lines.push(`  ${e.title}, ${e.org} (${e.date})`, `  ${e.desc}`));
  }
  if (cv.certifications.length) {
    lines.push('', 'CERTIFICATIONS:');
    cv.certifications.forEach(c => lines.push(`  ${c.title}, ${c.issuer} (${c.date})`));
  }
  if (cv.projects.length) {
    lines.push('', 'PROJECTS:');
    cv.projects.forEach(p2 => lines.push(`  ${p2.title} — ${p2.role} (${p2.date})`, `  ${p2.desc}`));
  }
  if (cv.awards.length) {
    lines.push('', 'AWARDS:');
    cv.awards.forEach(a => lines.push(`  ${a.title}, ${a.issuer} (${a.date})`));
  }
  if (cv.languages.length) {
    lines.push('', 'LANGUAGES:');
    cv.languages.forEach(l => lines.push(`  ${l.name}: ${l.level}`));
  }
  if (p.interests) lines.push('', `INTERESTS: ${p.interests}`);
  return lines.join('\n');
}

export async function reviewCV(cv: CV, jobDescription: string): Promise<AIResult> {
  const userMsg = jobDescription.trim()
    ? `JOB DESCRIPTION TO MATCH:\n${jobDescription}\n\n---\n\nMY CV:\n${cvToText(cv)}`
    : `Please analyse this CV for general ATS optimisation (no specific job description provided):\n\n${cvToText(cv)}`;
  const raw = await callProxy({
    model: MODEL,
    max_tokens: 8192,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: REVIEW_SYSTEM },
      { role: 'user', content: userMsg },
    ],
  });
  return parseJSONFromText<AIResult>(raw);
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
