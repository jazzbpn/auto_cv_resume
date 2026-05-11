import { showToast } from '../components/Toast';
import { cvLang } from '../state/store';

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

/** Filesystem-safe version of the user's name: keeps case, swaps spaces for underscores, strips problematic chars. */
function fileSafeName(s: string): string {
  return s.trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '').replace(/_+/g, '_') || 'Resume';
}

/** YYYY-MM-DD_HH-MM-SS in local time. */
function timestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function exportFilename(): string {
  return `${fileSafeName(getName())}_${timestamp()}`;
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
@media screen {
  body { padding: 24px; }
  .resume {
    margin: 0 auto !important;
    box-shadow: none !important;
    transform: none !important;
    width: 700px;
    min-height: auto !important;
  }
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
  const docDir = node.getAttribute('dir') ?? 'ltr';
  // Title is the suggested filename for "Save as PDF" — the browser uses
  // the document title for that. The @top-* margin overrides above try to
  // keep this string out of the printed page header.
  const title = exportFilename();
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Playfair+Display:wght@700;900&display=swap">`;
  // @page must come before collected styles so nothing can override it.
  // Omitting `size` lets the system use its native paper size (avoids
  // mobile print engines rescaling A4 content and re-adding margins).
  const pageReset = `@page{margin:0mm!important;size:auto;}`;
  return `<!doctype html><html lang="${cvLang.value}" dir="${docDir}"><head><meta charset="UTF-8"><title>${title}</title>${fonts}<style>${pageReset}\n${styles}\n${PRINT_OVERRIDES}</style></head><body>${clone.outerHTML}</body></html>`;
}

function downloadHTMLFallback(html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${exportFilename()}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('Downloaded. Open the file in your browser, then Print → Save as PDF.');
}

export async function printResume(): Promise<void> {
  const btn = document.querySelector<HTMLButtonElement>('.export-btn');
  const btnText = btn?.querySelector<HTMLElement>('.btn-text');
  const original = btnText?.textContent ?? '';
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Preparing…';

  try {
    const html = buildPrintHTML();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    document.getElementById('print-iframe')?.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    // 794px = A4 width at 96 dpi. Mobile WebKit/Android WebView resolve
    // percentage widths in @media print against the iframe's rendered width,
    // not the @page size, so a 1px iframe produces a 1px-wide layout that
    // gets scaled up with massive visible margins. Rendering at A4 width
    // makes width:100% map correctly to the full page.
    iframe.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px;border:none;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);

    let printed = false;
    const cleanup = () => { setTimeout(() => URL.revokeObjectURL(url), 60_000); };

    iframe.onload = async () => {
      // Wait for Google Fonts to actually finish loading inside the iframe
      // before printing. Without this, italic / weight variants may not be
      // ready yet and the browser synthesizes them by skewing or boldening
      // the regular face — which renders as visibly distorted letterforms
      // (the "flattened width" look) in the final PDF. Cap the wait so a
      // missing font never hangs the export.
      try {
        const fontsReady = iframe.contentDocument?.fonts?.ready;
        if (fontsReady) {
          await Promise.race([
            fontsReady,
            new Promise((r) => setTimeout(r, 3000)),
          ]);
        }
      } catch {
        // Older browsers without document.fonts — fall through to print.
      }

      // Chrome / Safari pull the suggested PDF filename from the parent
      // document's title, not the iframe's. Swap it temporarily.
      const filename = exportFilename();
      const originalTitle = document.title;
      document.title = filename;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        printed = true;
      } catch (e) {
        console.error('[print] iframe print failed:', e);
        downloadHTMLFallback(html);
      } finally {
        // Restore after the print dialog has captured the title. A small
        // delay avoids races where the browser reads the title async.
        setTimeout(() => { document.title = originalTitle; }, 1500);
      }
      cleanup();
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
        const filename = exportFilename();
        const originalTitle = document.title;
        document.title = filename;
        try { iframe.contentWindow?.print(); printed = true; }
        catch { /* ignore */ }
        finally { setTimeout(() => { document.title = originalTitle; }, 1500); }
      }
    }, 4000);
  } catch (e) {
    console.error('[print] PDF export failed:', e);
    showToast(e instanceof Error ? e.message : 'PDF export failed.');
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = original;
  }
}
