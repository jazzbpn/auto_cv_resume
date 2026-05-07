import { useState } from 'preact/hooks';
import { aiResult, aiSnapshot, applyAIFix, undoAIFix, commitAIFix } from '../state/store';
import { aiJD, aiStatus, aiError, runAIReview } from '../state/ai';
import { showToast } from './Toast';
import type { AIResult, AIIssue } from '../types';

async function applyAIFixAndRescore(): Promise<void> {
  applyAIFix();
  // After mutating the form, re-run analysis so the displayed score and
  // issues reflect the rewritten content (otherwise the panel still shows
  // the score of the previous version).
  await runAIReview();
}

export function AnalysePanel() {
  const r = aiResult.value;
  const fixed = !!aiSnapshot.value;
  const loading = aiStatus.value === 'loading';

  return (
    <div class="analyse-panel">
      <div class="analyse-scroll">
        <header class="analyse-header">
          <h2>ATS Analysis</h2>
          <p>Score your CV. Optional job description for targeted match.</p>
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
            class="analyse-run-btn"
            disabled={loading}
            onClick={() => { void runAIReview(); }}
          >
            {loading
              ? <><span class="ai-spinner" /> Analysing…</>
              : r ? <>↻ Re-analyse</> : <>✦ Analyse my CV</>}
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
              Click <strong>Analyse my CV</strong> to get an ATS score, see
              issues, and find missing keywords.
            </p>
          </div>
        )}

        {r && (
          <div class="analyse-results">
            <HeroScore result={r} canApplyFix={!fixed} />
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
          </div>
        )}
      </div>

      {r && (
        <footer class="analyse-footer">
          {!fixed ? (
            <div class="analyse-fix-cta">
              <div>
                <strong>Fix everything for me</strong>
                <p>
                  Apply our rewrites to your summary and experience descriptions —
                  writes directly into the form. You can undo.
                </p>
              </div>
              <button
                type="button"
                class="analyse-fix-btn"
                disabled={loading}
                onClick={() => { void applyAIFixAndRescore(); }}
              >
                {loading
                  ? <><span class="ai-spinner ai-spinner-light" /> Rescoring…</>
                  : <>✦ Fix Resume with AI</>}
              </button>
            </div>
          ) : (
            <div class="analyse-undo-cta">
              <div>
                <strong>✓ AI rewrites applied to your form</strong>
                <p>Save to make these changes permanent, or undo to revert to your original text.</p>
              </div>
              <div class="analyse-cta-row">
                <button
                  type="button"
                  class="analyse-save-btn"
                  onClick={() => {
                    commitAIFix();
                    showToast('✓ Changes saved. AI rewrites are now part of your CV.');
                  }}
                >
                  ✓ Save Changes
                </button>
                <button type="button" class="analyse-undo-btn" onClick={undoAIFix}>
                  ↶ Undo
                </button>
              </div>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}

/* ── Hero score: large ring + summary + projected lift ───────────────────── */

function HeroScore({ result: r, canApplyFix }: { result: AIResult; canApplyFix: boolean }) {
  const score = Math.max(0, Math.min(100, r.ats_score | 0));
  const projected = Math.max(score, Math.min(100, (r.optimized_ats_score ?? score) | 0));
  const delta = projected - score;
  const band = scoreBand(score);
  const color = bandColor(score);

  const R = 36, C = 2 * Math.PI * R;
  const dash = C * (score / 100);

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
        <div class="hero-ring-num" style={`color:${color}`}>{score}</div>
      </div>
      <div class="hero-meta">
        <div class="hero-eyebrow">ATS Score</div>
        <div class="hero-label">{r.score_label}</div>
        <div class="hero-summary">{r.summary}</div>
        {canApplyFix && delta > 0 && (
          <div class="hero-potential">
            <span class="hero-potential-arrow" aria-hidden>↗</span>
            Potential <b>{projected}</b> <span class="hero-delta">+{delta}</span> with AI fix
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
