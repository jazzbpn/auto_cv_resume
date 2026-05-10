import { useState, useEffect, useRef } from 'preact/hooks';
import { aiResult, aiOptimize, aiSnapshot, applyAIFix, undoAIFix, commitAIFix } from '../state/store';
import { aiJD, aiStatus, aiError, aiOptimizeStatus, aiOptimizeError, runAIReview, runAIOptimize } from '../state/ai';
import { track, classifyAIError, markAIUsed } from '../services/analytics';
import { showToast } from './Toast';
import type { AIResult, AIIssue } from '../types';

/**
 * One-click fix: apply the AI's rewrites into the form + preview, swap the
 * displayed score to the optimized projection, collapse the panel to the
 * "fixed" state. No second API call — we trust the optimized_ats_score the
 * model already returned in the initial analysis. Undo and Re-analyse stay
 * one click away in the success banner.
 */
async function autoFixResume(): Promise<void> {
  track('ai_autofix');
  markAIUsed();
  // Rewrites are fetched in the background after the analysis lands. If the
  // user clicks Auto-Fix before that lands (or the prefetch failed), trigger
  // / await the optimize call now so we have something to apply.
  if (!aiOptimize.value) {
    showToast('Preparing your AI fixes…');
    await runAIOptimize();
  }
  // The optimize call itself failed (network / parse / truncation). Surface
  // the real cause instead of the generic "no rewrite text" message — that
  // would imply the AI ran successfully and just had nothing to say.
  if (!aiOptimize.value && aiOptimizeStatus.value === 'error') {
    track('ai_error', { stage: 'autofix', reason: classifyAIError(aiOptimizeError.value) });
    showToast(`Auto-Fix failed: ${aiOptimizeError.value || 'try Re-analyse and Auto-Fix again.'}`);
    return;
  }
  const applied = applyAIFix();
  if (applied) {
    track('ai_autofix_success');
    showToast('✓ Resume optimized. Score updated. Tap Undo to revert.');
    return;
  }
  // applyAIFix returned false: the optimize call succeeded but the AI
  // returned all-empty rewrites. With the current prompt this should be
  // rare; if it happens, distinguish "already optimal" from "weak response".
  const opt = aiOptimize.value;
  const r = aiResult.value;
  const sameScore = !!(opt && r && opt.optimized_ats_score <= r.ats_score);
  showToast(
    sameScore
      ? '✓ Your CV is already optimised — no rewrites needed.'
      : 'AI returned no rewrite text. Tap Re-analyse to try again.',
  );
}

async function reAnalyseFresh(): Promise<void> {
  // Re-analyse operates on the current CV. We *don't* drop the fix snapshot
  // up-front: doing so would flip the panel out of the "fixed" state during
  // the AI call and the score would visibly regress (optimised → base →
  // newScore). Instead, await the new result and only commit on success —
  // a failed rescore leaves the fix in place so the user can retry.
  await runAIReview();
  if (aiStatus.value !== 'error') commitAIFix();
}

const ANALYSE_PHASES = [
  'Reading your CV…',
  'Scanning ATS keywords…',
  'Cross-checking formatting & structure…',
  'Evaluating impact statements…',
  'Compiling recommendations…',
  'Finalising your score…',
];

function useCyclingPhrase(phrases: string[], intervalMs = 2400): string {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setIdx(i => (i + 1) % phrases.length),
      intervalMs,
    );
    return () => window.clearInterval(id);
  }, [phrases, intervalMs]);
  return phrases[idx]!;
}

export function AnalysePanel() {
  const r = aiResult.value;
  const opt = aiOptimize.value;
  const fixed = !!aiSnapshot.value;
  const loading = aiStatus.value === 'loading';
  const optimizing = aiOptimizeStatus.value === 'loading';
  const phase = useCyclingPhrase(ANALYSE_PHASES);

  return (
    <div class="analyse-panel">
      <div class="analyse-scroll">
        <header class="analyse-header">
          <h2>Resume/CV Analysis</h2>
        </header>

        <div class="analyse-jd">
          <label class="analyse-jd-label">
            Job description <span>(optional)</span>
          </label>
          <textarea
            rows={4}
            class="analyse-jd-textarea"
            placeholder="Paste a job description for keyword matching and role-specific feedback…"
            value={aiJD.value}
            onInput={(e) => { aiJD.value = (e.currentTarget as HTMLTextAreaElement).value; }}
          />
          <button
            type="button"
            class={`analyse-run-btn${loading ? ' analyse-run-btn-loading' : ''}`}
            disabled={loading}
            onClick={() => { void reAnalyseFresh(); }}
          >
            {loading ? (
              <span class="run-btn-loading">
                <span class="run-btn-loading-row">
                  <span class="ai-spinner" />
                  <span class="run-btn-phase" key={phase}>{phase}</span>
                </span>
                <span class="run-btn-hint">Typically 10–15 seconds</span>
              </span>
            ) : r ? <>↻ Re-analyse</> : <>✦ Analyse my Resume</>}
          </button>
          {aiStatus.value === 'error' && (
            <div class="analyse-error" role="alert">
              <span aria-hidden>⚠</span> {aiError.value}
            </div>
          )}
        </div>

        {!r && !loading && (
          <div class="analyse-empty">
            <span aria-hidden>📊</span>
            <p>
              Click <strong>Analyse my Resume</strong> to get an ATS score, see
              issues, and find missing keywords.
            </p>
          </div>
        )}

        {loading && !r && <AnalyseSkeleton />}

        {r && (
          <div class="analyse-results">
            <HeroScore result={r} optimized={opt?.optimized_ats_score ?? null} fixed={fixed} />
            {fixed ? (
              <FixedBanner result={r} optimized={opt?.optimized_ats_score ?? null} />
            ) : (
              <>
                <SeverityBar issues={r.issues} />
                <KeywordMeter
                  present={r.keywords_present}
                  missing={r.keywords_missing}
                />
                <IssuesAccordion issues={r.issues} quickWins={r.quick_wins} />
                <KeywordsAccordion
                  present={r.keywords_present}
                  missing={r.keywords_missing}
                />
              </>
            )}
          </div>
        )}
      </div>

      {r && !fixed && (
        <footer class="analyse-footer">
          <div class="analyse-fix-cta">
            <div>
              <strong>One-click optimisation</strong>
              <p>
                Apply our rewrites across your summary, objective, skills,
                experience, education, and projects in one tap. You can undo
                any time.
              </p>
            </div>
            <button
              type="button"
              class="analyse-fix-btn"
              disabled={loading}
              onClick={() => { void autoFixResume(); }}
            >
              {optimizing && !opt ? '✦ Preparing fixes…' : '✦ Auto-Fix My Resume'}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

/* ── Fixed-state success banner: shown after one-click auto-fix ────────────── */

function FixedBanner({ result: r, optimized }: { result: AIResult; optimized: number | null }) {
  const base = Math.max(0, Math.min(100, r.ats_score | 0));
  const optimised = Math.max(base, Math.min(100, (optimized ?? base) | 0));
  const delta = optimised - base;
  return (
    <div class="fixed-banner">
      <div class="fixed-banner-head">
        <span class="fixed-banner-icon" aria-hidden>✓</span>
        <div>
          <strong>Resume optimised</strong>
          <p>
            AI rewrites are now in your form and preview.
            {delta > 0 && (
              <> Score went from <b>{base}</b> to <b>{optimised}</b> <span class="fixed-banner-delta">+{delta}</span>.</>
            )}
          </p>
        </div>
      </div>
      <div class="fixed-banner-actions">
        <button type="button" class="analyse-undo-btn" onClick={() => { track('ai_autofix_undo'); undoAIFix(); }}>
          ↶ Undo
        </button>
      </div>
    </div>
  );
}

/* ── Hero score: large ring + summary + projected lift ───────────────────── */

function useCountUp(target: number, durationMs = 900): number {
  const [val, setVal] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number>(0);
  const rafRef = useRef<number>();
  const valRef = useRef<number>(0);
  valRef.current = val;

  useEffect(() => {
    // Tween from the currently-displayed value to the new target so a
    // rescore animates 75 → 82 instead of jumping to 0 then counting up.
    fromRef.current = valRef.current;
    startRef.current = null;
    cancelAnimationFrame(rafRef.current!);
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setVal(Math.round(next));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current!);
  }, [target, durationMs]);

  return val;
}

function HeroScore({ result: r, optimized, fixed }: { result: AIResult; optimized: number | null; fixed: boolean }) {
  const baseScore = Math.max(0, Math.min(100, r.ats_score | 0));
  const optimised = Math.max(baseScore, Math.min(100, (optimized ?? baseScore) | 0));
  const score = fixed ? optimised : baseScore;
  // No projected delta until the background optimize call lands. Until then,
  // the "Potential X / +Y with AI fix" line stays hidden — avoids showing
  // a misleading "+0" while rewrites are still being generated.
  const delta = optimized != null ? optimised - baseScore : 0;
  const band = scoreBand(score);
  const color = bandColor(score);

  const animatedScore = useCountUp(score, 900);
  const R = 36, C = 2 * Math.PI * R;
  const dash = C * (animatedScore / 100);

  return (
    <div class={`hero-score hero-${band}`}>
      <div class="hero-ring-wrap">
        <svg class="hero-ring" viewBox="0 0 80 80" aria-hidden>
          <circle class="hero-ring-bg" cx="40" cy="40" r={R} />
          <circle
            class="hero-ring-fg"
            cx="40" cy="40" r={R}
            stroke={color}
            stroke-dasharray={`${dash} ${C}`}
            stroke-dashoffset={C * 0.25}
            style="transform:rotate(-90deg);transform-origin:center"
          />
        </svg>
        <div class="hero-ring-num" style={`color:${color}`}>{animatedScore}</div>
      </div>
      <div class="hero-meta">
        <div class="hero-eyebrow">ATS Score{fixed && delta > 0 ? ' · Optimised' : ''}</div>
        <div class="hero-label">{r.score_label}</div>
        <div class="hero-summary">{r.summary}</div>
        {!fixed && delta > 0 && (
          <div class="hero-potential">
            <span class="hero-potential-arrow" aria-hidden>↗</span>
            Potential <b>{optimised}</b> <span class="hero-delta">+{delta}</span> with AI fix
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Severity breakdown: stacked bar with counts ─────────────────────────── */

function SeverityBar({ issues }: { issues: AIIssue[] }) {
  const counts = { critical: 0, warning: 0, tip: 0 };
  for (const i of issues) counts[i.severity]++;
  const total = counts.critical + counts.warning + counts.tip;
  if (!total) return null;

  const pc = (n: number) => Math.round((n / total) * 100);

  return (
    <div class="sev-bar">
      <div class="sev-head">
        <span class="sev-title">Issue breakdown</span>
        <span class="sev-total">{total} total</span>
      </div>
      <div class="sev-track" role="img" aria-label={
        `${counts.critical} critical, ${counts.warning} warning, ${counts.tip} tip`
      }>
        {counts.critical > 0 && (
          <span class="sev-seg sev-critical" style={`width:${pc(counts.critical)}%`} />
        )}
        {counts.warning > 0 && (
          <span class="sev-seg sev-warning"  style={`width:${pc(counts.warning)}%`} />
        )}
        {counts.tip > 0 && (
          <span class="sev-seg sev-tip"      style={`width:${pc(counts.tip)}%`} />
        )}
      </div>
      <div class="sev-legend">
        <SevPill cls="critical" emoji="🔴" label="Critical"  count={counts.critical} />
        <SevPill cls="warning"  emoji="🟡" label="Warnings"  count={counts.warning} />
        <SevPill cls="tip"      emoji="🟢" label="Tips"      count={counts.tip} />
      </div>
    </div>
  );
}

function SevPill({ cls, emoji, label, count }: {
  cls: string; emoji: string; label: string; count: number;
}) {
  return (
    <span class={`sev-pill sev-pill-${cls}${count === 0 ? ' sev-pill-zero' : ''}`}>
      <span aria-hidden>{emoji}</span>
      <b>{count}</b> {label}
    </span>
  );
}

/* ── Keyword match meter: % gauge ────────────────────────────────────────── */

function KeywordMeter({ present, missing }: { present: string[]; missing: string[] }) {
  const total = present.length + missing.length;
  if (!total) return null;
  const pct = Math.round((present.length / total) * 100);

  return (
    <div class="kw-meter">
      <div class="kw-meter-head">
        <span class="kw-meter-title">Keyword match</span>
        <span class="kw-meter-count">
          <b>{present.length}</b> <span>/ {total} keywords</span>
        </span>
      </div>
      <div class="kw-meter-track">
        <div
          class={`kw-meter-fill kw-fill-${meterBand(pct)}`}
          style={`width:${pct}%`}
        />
      </div>
      <div class="kw-meter-pct">{pct}% matched</div>
    </div>
  );
}

/* ── Issues / quick wins accordion ───────────────────────────────────────── */

function IssuesAccordion({ issues, quickWins }: { issues: AIIssue[]; quickWins: string[] }) {
  const byCat = new Map<AIIssue['category'], AIIssue[]>();
  for (const i of issues) {
    const arr = byCat.get(i.category) ?? [];
    arr.push(i); byCat.set(i.category, arr);
  }
  const catColor: Record<AIIssue['category'], string> = {
    Issues: '#e74c3c', Formatting: '#e67e22', Keywords: '#3498db',
    Content: '#9b59b6', Impact: '#2ecc71',
  };

  return (
    <div class="ai-sections">
      {quickWins?.length > 0 && (
        <Collapsible title="⚡ Quick Wins" badge={quickWins.length} accent="#d4a017" defaultOpen>
          {quickWins.map((w, i) => (
            <div class="quick-win" key={i}>
              <span class="quick-win-icon" aria-hidden>💡</span>
              <span class="quick-win-text">{w}</span>
            </div>
          ))}
        </Collapsible>
      )}

      {[...byCat.entries()].map(([cat, items]) => (
        <Collapsible
          title={cat}
          badge={items.length}
          accent={catColor[cat] ?? '#a09080'}
          defaultOpen
          key={cat}
        >
          {items.map((i, k) => <IssueCard issue={i} key={k} />)}
        </Collapsible>
      ))}
    </div>
  );
}

function IssueCard({ issue }: { issue: AIIssue }) {
  return (
    <div class={`issue-card issue-${issue.severity}`}>
      <div class="issue-card-stripe" aria-hidden />
      <div class="issue-card-body">
        <div class="issue-card-head">
          <span class="issue-sev-icon" aria-hidden>
            {issue.severity === 'critical' ? '🔴'
              : issue.severity === 'warning' ? '🟡' : '🟢'}
          </span>
          <span class="issue-card-title">{issue.title}</span>
        </div>
        <div class="issue-card-desc">{issue.description}</div>
        {issue.fix && (
          <div class="issue-card-fix">
            <span class="issue-card-fix-eyebrow">Fix</span>
            {issue.fix}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Keywords accordion ──────────────────────────────────────────────────── */

function KeywordsAccordion({ present, missing }: { present: string[]; missing: string[] }) {
  if (!present.length && !missing.length) return null;
  return (
    <div class="ai-sections">
      <Collapsible title="ATS Keywords" badge={present.length + missing.length} accent="#3498db" defaultOpen>
        {present.length > 0 && (
          <div class="ai-kw-block">
            <div class="ai-kw-head ai-kw-found">✓ Found in your CV</div>
            <div class="ai-kw-wrap">
              {present.slice(0, 30).map((k, i) => <span class="ai-kw present" key={i}>{k}</span>)}
            </div>
          </div>
        )}
        {missing.length > 0 && (
          <div class="ai-kw-block">
            <div class="ai-kw-head ai-kw-missing">✗ Missing — add these</div>
            <div class="ai-kw-wrap">
              {missing.slice(0, 30).map((k, i) => <span class="ai-kw missing" key={i}>{k}</span>)}
            </div>
          </div>
        )}
      </Collapsible>
    </div>
  );
}

/* ── Generic collapsible ─────────────────────────────────────────────────── */

function Collapsible({
  title, badge, accent = '#a09080', defaultOpen = false, children,
}: {
  title: string;
  badge?: number;
  accent?: string;
  defaultOpen?: boolean;
  children: preact.ComponentChildren;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div class="ai-section">
      <button
        type="button"
        class={`ai-section-hd${open ? ' open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span class="ai-section-dot" style={`background:${accent}`} aria-hidden />
        <span class="ai-section-title">{title}</span>
        {badge !== undefined && (
          <span class="ai-section-badge">{badge}</span>
        )}
        <span class="ai-arrow" aria-hidden>▾</span>
      </button>
      {open && <div class="ai-section-body">{children}</div>}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/* ── Skeleton loader (shown while AI request is in flight) ─────────────────── */

function AnalyseSkeleton() {
  return (
    <div class="analyse-skeleton" aria-busy="true" aria-label="Analysing your CV">
      <div class="sk-hero">
        <div class="sk-ring" />
        <div class="sk-meta">
          <div class="sk-line sk-line-eyebrow" />
          <div class="sk-line sk-line-title" />
          <div class="sk-line sk-line-summary" />
          <div class="sk-line sk-line-summary sk-line-short" />
        </div>
      </div>
      <div class="sk-block">
        <div class="sk-line sk-line-label" />
        <div class="sk-bar" />
        <div class="sk-pills">
          <div class="sk-pill" /><div class="sk-pill" /><div class="sk-pill" />
        </div>
      </div>
      <div class="sk-block">
        <div class="sk-line sk-line-label" />
        <div class="sk-bar" />
      </div>
      <div class="sk-cards">
        <div class="sk-card"><div class="sk-line sk-line-title" /><div class="sk-line sk-line-summary" /><div class="sk-line sk-line-summary sk-line-short" /></div>
        <div class="sk-card"><div class="sk-line sk-line-title" /><div class="sk-line sk-line-summary" /></div>
      </div>
    </div>
  );
}

function scoreBand(s: number): string {
  if (s >= 80) return 'excellent';
  if (s >= 60) return 'good';
  if (s >= 40) return 'fair';
  return 'poor';
}
function bandColor(s: number): string {
  if (s >= 80) return '#2ecc71';
  if (s >= 60) return '#d4a017';
  if (s >= 40) return '#e67e22';
  return '#e74c3c';
}
function meterBand(pct: number): string {
  if (pct >= 75) return 'excellent';
  if (pct >= 50) return 'good';
  if (pct >= 25) return 'fair';
  return 'poor';
}
