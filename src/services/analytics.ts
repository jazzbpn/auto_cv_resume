type UmamiGlobal = { track: (name: string, props?: Record<string, unknown>) => void };

declare global {
  interface Window { umami?: UmamiGlobal }
}

// Single off-switch for analytics. Flip to `true` when the site is out of
// testing and ready to record real-user data. While false:
//   - The Umami script is NOT injected (no auto-pageview, no network call).
//   - track() is a no-op.
// Nothing in the codebase reads umami beyond this module, so this flag is the
// only place to toggle.
const ANALYTICS_ENABLED = true;

const UMAMI_SRC = 'https://cloud.umami.is/script.js';
const UMAMI_WEBSITE_ID = 'a85adcc4-7914-47a0-94ae-1a09590d6509';

if (ANALYTICS_ENABLED && typeof document !== 'undefined') {
  const s = document.createElement('script');
  s.defer = true;
  s.src = UMAMI_SRC;
  s.dataset.websiteId = UMAMI_WEBSITE_ID;
  document.head.appendChild(s);
}

export type ScoreBucket = '<50' | '50-69' | '70-84' | '85+';
export type AIStage = 'analyze' | 'autofix';
export type ImportErrorStage = 'extract' | 'parse' | 'too_short';
export type AIErrorReason =
  | 'network' | 'auth' | 'quota' | 'rate_limit' | 'timeout'
  | 'http_5xx' | 'http_4xx' | 'empty' | 'invalid_json' | 'unknown';

export type AnalyticsEvent =
  | { name: 'editor_first_input' }
  | { name: 'template_selected'; props: { id: string } }
  | { name: 'import_success'; props: { format: string } }
  | { name: 'import_error'; props: { stage: ImportErrorStage } }
  | { name: 'ai_analyze'; props: { with_jd: boolean; score_bucket: ScoreBucket } }
  | { name: 'ai_autofix' }
  | { name: 'ai_autofix_success' }
  | { name: 'ai_autofix_undo' }
  | { name: 'ai_error'; props: { stage: AIStage; reason: AIErrorReason } }
  | { name: 'export'; props: { template: string; sections_visible_count: number; ai_used: boolean } };

export function track<E extends AnalyticsEvent>(
  ...args: E extends { props: infer P } ? [E['name'], P] : [E['name']]
): void {
  if (!ANALYTICS_ENABLED) return;
  if (typeof window === 'undefined') return;
  try {
    const [name, props] = args as [string, Record<string, unknown> | undefined];
    window.umami?.track(name, props);
  } catch {
    // Analytics failures must never break the app.
  }
}

export function scoreBucket(n: number): ScoreBucket {
  if (n < 50) return '<50';
  if (n < 70) return '50-69';
  if (n < 85) return '70-84';
  return '85+';
}

// Map any error into one of a fixed set of tokens. The OUTPUT is bounded — we
// never forward the raw string. Error messages in this app can include API key
// references, dev hints, and (worst case) upstream response bodies that echo
// the request — none of which belongs in analytics.
export function classifyAIError(e: unknown): AIErrorReason {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (/Could not reach the AI endpoint/i.test(m)) return 'network';
  if (/api key|rejected the api key/i.test(m)) return 'auth';
  if (/insufficient balance|top up|quota/i.test(m)) return 'quota';
  if (/too many requests|rate.?limit/i.test(m)) return 'rate_limit';
  if (/timed out|timeout/i.test(m)) return 'timeout';
  if (/temporarily unavailable|status 5\d\d/i.test(m)) return 'http_5xx';
  if (/refused the request|status 4\d\d/i.test(m)) return 'http_4xx';
  if (/empty response|\bempty\b/i.test(m)) return 'empty';
  if (/not valid JSON|invalid[_ ]json/i.test(m)) return 'invalid_json';
  return 'unknown';
}

let aiUsedThisSession = false;
export function markAIUsed(): void { aiUsedThisSession = true; }
export function wasAIUsed(): boolean { return aiUsedThisSession; }
