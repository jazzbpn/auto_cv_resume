import { showToast } from '../components/Toast';

/** Filesystem-safe version of the user's name. */
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

export async function printResume(): Promise<void> {
  const btn = document.querySelector<HTMLButtonElement>('.export-btn');
  const btnText = btn?.querySelector<HTMLElement>('.btn-text');
  const original = btnText?.textContent ?? '';
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Preparing…';

  try {
    await printInline();
  } catch (e) {
    console.error('[print] PDF export failed:', e);
    showToast(e instanceof Error ? e.message : 'PDF export failed.');
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = original;
  }
}

/**
 * Prints by cloning the resume into the main document and calling window.print().
 *
 * Why not window.open(): on iOS Safari, window.open() opens a background tab
 * and window.print() called on it never shows the dialog. On Android/iOS
 * WebViews it is blocked entirely. Calling window.print() on the current
 * window is never blocked and respects our injected @page CSS on all platforms.
 */
async function printInline(): Promise<void> {
  const node = getResumeNode();
  if (!node) throw new Error('Could not find the CV preview to print. Open the Preview tab and try again.');

  const STYLE_ID = 'cv-print-override';
  const CLONE_ID = 'cv-print-clone';

  document.getElementById(STYLE_ID)?.remove();
  document.getElementById(CLONE_ID)?.remove();

  // Clone the resume off-screen so it doesn't affect the visible layout.
  const clone = node.cloneNode(true) as HTMLElement;
  clone.id = CLONE_ID;
  clone.style.cssText = 'position:fixed;left:-99999px;top:0;transform:none;box-shadow:none;pointer-events:none;';
  document.body.appendChild(clone);

  // Set the document title to the desired PDF filename; browsers use it when
  // the user chooses "Save as PDF" from the print dialog.
  const prevTitle = document.title;
  document.title = exportFilename();

  const docDir = node.getAttribute('dir') ?? 'ltr';

  const style = document.createElement('style');
  style.id = STYLE_ID;
  // @page placed last so it wins the UA-stylesheet cascade.
  // !important is invalid inside @page descriptors — source-order wins instead.
  style.textContent =
    `@media print{` +
    `*,*::before,*::after{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}` +
    `html{direction:${docDir};}` +
    `html,body{margin:0!important;padding:0!important;background:#fff!important;}` +
    // Hide every direct child of body EXCEPT the print clone.
    // Specificity: body>* = (0,0,1); #CLONE_ID = (1,0,0) — ID wins, so clone stays visible.
    `body>*{display:none!important;}` +
    `#${CLONE_ID}{display:block!important;position:static!important;left:auto!important;` +
    `width:100%!important;margin:0!important;transform:none!important;box-shadow:none!important;min-height:auto!important;}` +
    // Ensure coloured fills (modern template, badges, etc.) survive print.
    `.mod-left,.mod-sf,.skill-tag,.ai-kw,[class*="badge-"],[class*="sev-"],[class*="hero-"]` +
    `{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}` +
    `}` +
    `@page{size:A4;margin:0;}`;
  document.head.appendChild(style);

  // Fonts are likely already loaded (the preview is visible), but wait briefly
  // to be safe — especially for users who just switched to the Preview tab.
  try {
    await Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  } catch { /* browsers without document.fonts */ }

  const cleanup = () => {
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(CLONE_ID)?.remove();
    document.title = prevTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Safety: some WebViews never fire afterprint.
  setTimeout(cleanup, 10_000);

  window.print();
}
