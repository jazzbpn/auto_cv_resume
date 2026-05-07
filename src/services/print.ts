import { showToast } from '../components/Toast';

/**
 * PDF export — uses the browser's native "Save as PDF" via window.print().
 *
 * This is the only in-browser path that produces a real vector PDF with
 * selectable text (which ATS systems read cleanly). html2canvas-based
 * approaches embed page screenshots and aren't true PDFs from a parser's
 * point of view.
 *
 * Trade-off: the browser's print dialog adds URL / date / title in the
 * page header by default. We suppress as much as possible (blank title,
 * @top-* reset rules) and tell the user — once, via toast — to untick
 * "Headers and footers" if they want a totally clean output.
 */

function slug(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'resume';
}

function getResumeNode(): HTMLElement | null {
  return document.querySelector('.panel-preview .resume');
}

function getName(): string {
  const node = document.querySelector<HTMLElement>('.resume .r-name, .resume .mod-name');
  return node?.textContent?.trim() || 'resume';
}

function collectStyles(): string {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const r of Array.from(rules)) out.push(r.cssText);
    } catch {
      // Cross-origin stylesheet (e.g. Google Fonts) — skip; the @import in
      // the print HTML reloads the same fonts.
    }
  }
  return out.join('\n');
}

const PRINT_OVERRIDES = `
/* Standalone-file view (in case the user opens the downloaded HTML). */
html, body {
  height: auto !important;
  overflow: auto !important;
  background: #fff !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
}
body { padding: 24px; }
.resume {
  margin: 0 auto !important;
  box-shadow: none !important;
  transform: none !important;
  width: 700px;
  min-height: auto !important;
}

/* Real per-page margins on every page. The blank @top-* / @bottom-*
   margin boxes are an attempt to override browser-injected header/footer
   content; they're respected by some browsers but not all. */
@page {
  size: A4;
  margin: 12mm;
  @top-left-corner { content: ""; }
  @top-left        { content: ""; }
  @top-center      { content: ""; }
  @top-right       { content: ""; }
  @top-right-corner{ content: ""; }
  @bottom-left-corner { content: ""; }
  @bottom-left        { content: ""; }
  @bottom-center      { content: ""; }
  @bottom-right       { content: ""; }
  @bottom-right-corner{ content: ""; }
}

@media print {
  /* Force all backgrounds, gradients, and tinted text to actually print. */
  *, *::before, *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    overflow: visible !important;
  }
  .resume {
    width: 100% !important;
    margin: 0 !important;
    box-shadow: none !important;
    transform: none !important;
    min-height: auto !important;
  }
  /* Belt-and-suspenders for the modern template's coloured fills. */
  .resume.modern .mod-left,
  .resume.modern .mod-sf,
  .skill-tag, .ai-kw,
  [class*="badge-"], [class*="sev-"], [class*="hero-"] {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

function buildPrintHTML(): string {
  const node = getResumeNode();
  if (!node) {
    throw new Error('Could not find the CV preview to print. Open the Preview tab and try again.');
  }
  // Strip any layout transforms / shadows from the cloned copy.
  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.boxShadow = 'none';
  const styles = collectStyles();
  // Title is a single space so the browser's print header reads "" rather
  // than the document title (e.g. "CV Builder").
  const title = ' ';
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Mono:wght@400;500&family=Crimson+Pro:ital,wght@0,400;1,400&display=swap">`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title>${fonts}<style>${styles}\n${PRINT_OVERRIDES}</style></head><body>${clone.outerHTML}</body></html>`;
}

function downloadHTMLFallback(html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${slug(getName())}-cv.html`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('Downloaded as HTML. Open it in your browser, then Print → Save as PDF.');
}

const HEADERS_TIP_KEY = 'cv-pdf-headers-tip-shown';

function showHeadersTipOnce() {
  try {
    if (localStorage.getItem(HEADERS_TIP_KEY)) return;
    showToast('Tip: untick "Headers and footers" in the print dialog for a totally clean PDF.');
    localStorage.setItem(HEADERS_TIP_KEY, '1');
  } catch {
    // Privacy mode / quota — show the tip anyway, every time
    showToast('Tip: untick "Headers and footers" in the print dialog for a totally clean PDF.');
  }
}

export async function printResume(): Promise<void> {
  const btn = document.querySelector<HTMLButtonElement>('.export-btn');
  const original = btn?.textContent ?? '';
  if (btn) { btn.textContent = 'Preparing…'; btn.disabled = true; }

  try {
    const html = buildPrintHTML();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    document.getElementById('print-iframe')?.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    iframe.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0';
    document.body.appendChild(iframe);

    let printed = false;
    const cleanup = () => { setTimeout(() => URL.revokeObjectURL(url), 60_000); };

    iframe.onload = () => {
      // Allow Google Fonts to settle so the print preview shows correct glyphs.
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          printed = true;
          showHeadersTipOnce();
        } catch (e) {
          console.error('[print] iframe print failed:', e);
          downloadHTMLFallback(html);
        }
        cleanup();
      }, 800);
    };
    iframe.onerror = () => {
      console.error('[print] iframe load failed');
      downloadHTMLFallback(html);
      cleanup();
    };
    iframe.src = url;

    // Last-resort safety net if onload never fires
    setTimeout(() => {
      if (!printed) {
        try { iframe.contentWindow?.print(); printed = true; showHeadersTipOnce(); }
        catch { /* ignore */ }
      }
    }, 4000);
  } catch (e) {
    console.error('[print] PDF export failed:', e);
    showToast(e instanceof Error ? e.message : 'PDF export failed.');
  } finally {
    if (btn) { btn.textContent = original; btn.disabled = false; }
  }
}
