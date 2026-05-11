import { showToast } from '../components/Toast';
import { cvLang } from '../state/store';

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
  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.boxShadow = 'none';
  const styles = collectStyles();
  const docDir = node.getAttribute('dir') ?? 'ltr';
  const title = exportFilename();
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Playfair+Display:wght@700;900&display=swap">`;
  // @page placed LAST so it wins the cascade over any UA-stylesheet @page rule.
  // !important is invalid inside @page descriptors (CSS spec) — source order wins instead.
  const pageReset = `@page{size:A4;margin:0;}`;
  // Inline script runs inside the new window — calls print() once fonts are
  // ready (or after 2.5 s), then closes the tab on afterprint.
  // Keeping print() inside the new window avoids the iOS issue where calling
  // win.print() from the parent after an await breaks the gesture chain.
  const autoprint = `<script>(function(){var d=false;function p(){if(d)return;d=true;window.print();window.addEventListener('afterprint',function(){window.close();});}if(document.fonts&&document.fonts.ready){document.fonts.ready.then(p);}setTimeout(p,2500);})();</script>`;
  return `<!doctype html><html lang="${cvLang.value}" dir="${docDir}"><head><meta charset="UTF-8"><title>${title}</title>${fonts}<style>${styles}\n${PRINT_OVERRIDES}\n${pageReset}</style></head><body>${clone.outerHTML}${autoprint}</body></html>`;
}

export async function printResume(): Promise<void> {
  const btn = document.querySelector<HTMLButtonElement>('.export-btn');
  const btnText = btn?.querySelector<HTMLElement>('.btn-text');
  const original = btnText?.textContent ?? '';
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Preparing…';

  const reenable = () => {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = original;
  };

  // Open synchronously — iOS Safari and Android Chrome block window.open()
  // if it is called after an await (outside the user-gesture call stack).
  const win = window.open('', '_blank');

  if (win) {
    // Primary path: new window owns its document, so iOS respects its
    // @page{margin:0} and <title> directly (no parent-injection needed).
    // window.print() is called by the inline <script> inside the HTML so it
    // runs in the new window's own context — avoids iOS gesture-chain issues
    // that broke calling win.print() from the parent after an await.
    try {
      const html = buildPrintHTML();
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    } catch (e) {
      win.close();
      console.error('[print] failed to write print window:', e);
      showToast(e instanceof Error ? e.message : 'PDF export failed.');
    } finally {
      // Re-enable after a short delay — afterprint on a child window is not
      // reliably observable from the parent.
      setTimeout(reenable, 1500);
    }
  } else {
    // Popup blocked (aggressive WebView, browser setting) — iframe fallback.
    // Note: on iOS the iframe's @page and parent-injected @page are both
    // ignored for decorations; user may still see URL/date in that case.
    try {
      const html = buildPrintHTML();
      await printViaIframe(html);
    } catch (e) {
      console.error('[print] iframe print failed:', e);
      showToast(e instanceof Error ? e.message : 'PDF export failed.');
    } finally {
      reenable();
    }
  }
}

async function printViaIframe(html: string): Promise<void> {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  document.getElementById('print-iframe')?.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'print-iframe';
  // 794px = A4 width in px at 96dpi so that %-based widths resolve correctly
  // when mobile WebKit calculates print layout from the iframe's rendered size.
  iframe.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px;border:none;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);

  let printed = false;

  iframe.onload = async () => {
    try {
      await Promise.race([
        iframe.contentDocument?.fonts?.ready ?? Promise.resolve(),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    } catch { /* browsers without document.fonts */ }

    // iOS Safari and Android Chrome read the *parent* page's @page rules when
    // printing iframe content — the iframe's own @page is ignored for the
    // header/footer margin area (where URL, date, page-number appear).
    // Injecting @page into the parent document suppresses those decorations
    // and sets A4 as the default paper size on both platforms.
    const PAGE_ID = 'cv-page-override';
    document.getElementById(PAGE_ID)?.remove();
    const pageStyle = document.createElement('style');
    pageStyle.id = PAGE_ID;
    pageStyle.textContent = '@page{size:A4;margin:0;}';
    document.head.appendChild(pageStyle);

    const removePageStyle = () => {
      document.getElementById(PAGE_ID)?.remove();
      window.removeEventListener('afterprint', removePageStyle);
    };
    window.addEventListener('afterprint', removePageStyle);
    // Safety cleanup if afterprint never fires (some WebViews).
    setTimeout(removePageStyle, 10_000);

    const filename = exportFilename();
    const prevTitle = document.title;

    // Set the suggested PDF filename on both the parent document (desktop
    // browsers, Android) and the iframe document (iOS Safari / WKWebView reads
    // the iframe's own title when generating the "Save as PDF" filename).
    document.title = filename;
    try { if (iframe.contentDocument) iframe.contentDocument.title = filename; }
    catch { /* cross-origin guard — blob: is same-origin, but be safe */ }

    // Restore the parent title after the print dialog closes, not on a fixed
    // timer. A short timer (old 1.5 s) could revert the title while the iOS
    // "Save as PDF" sheet is still open, causing the wrong filename to be used.
    const restoreTitle = () => {
      document.title = prevTitle;
      window.removeEventListener('afterprint', restoreTitle);
      iframe.contentWindow?.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    // iOS fires afterprint on the iframe's window, not the parent.
    iframe.contentWindow?.addEventListener('afterprint', restoreTitle);
    setTimeout(restoreTitle, 60_000); // safety fallback

    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      printed = true;
    } catch (e) {
      console.error('[print] iframe print failed:', e);
      removePageStyle();
      restoreTitle();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  iframe.onerror = () => {
    URL.revokeObjectURL(url);
    showToast('PDF export failed.');
  };
  iframe.src = url;

  // Safety: trigger print if onload is delayed (e.g. slow blob resolution).
  setTimeout(() => {
    if (!printed) {
      const filename = exportFilename();
      const prev = document.title;
      document.title = filename;
      try { if (iframe.contentDocument) iframe.contentDocument.title = filename; } catch { /* ignore */ }
      const restoreFallback = () => { document.title = prev; window.removeEventListener('afterprint', restoreFallback); };
      window.addEventListener('afterprint', restoreFallback);
      setTimeout(restoreFallback, 60_000);
      try { iframe.contentWindow?.print(); printed = true; }
      catch { /* ignore */ }
    }
  }, 4000);
}
