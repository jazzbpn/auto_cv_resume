/**
 * PDF / text extraction for CV import.
 *
 * pdfjs-dist is bundled as a separate lazy chunk: it only downloads the first
 * time the user drops a PDF. The worker is loaded as a separate asset URL so
 * Vite handles versioning and caching.
 */

const MAX_PDF_PAGES = 20;

interface TextItemLike { str?: string; type?: string }
interface TextContent { items: TextItemLike[] }
interface PdfPage { getTextContent: () => Promise<TextContent> }
interface PdfDocument { numPages: number; getPage: (n: number) => Promise<PdfPage> }
interface DocTask { promise: Promise<PdfDocument> }
interface PdfJsModule {
  getDocument: (src: { data: ArrayBuffer; useSystemFonts?: boolean; isEvalSupported?: boolean }) => DocTask;
  GlobalWorkerOptions: { workerSrc: string | URL };
}

let pdfjsPromise: Promise<PdfJsModule> | null = null;
async function getPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async (): Promise<PdfJsModule> => {
      const lib = (await import('pdfjs-dist')) as unknown as PdfJsModule;
      try {
        const workerUrlMod = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')) as { default: string };
        lib.GlobalWorkerOptions.workerSrc = workerUrlMod.default;
      } catch (e) {
        // If the worker URL can't be resolved, pdf.js falls back to a fake
        // worker that runs on the main thread (slower but functional).
        console.warn('[pdfText] worker unavailable, using main-thread fallback:', e);
      }
      return lib;
    })().catch((err) => {
      pdfjsPromise = null;
      throw err;
    });
  }
  return pdfjsPromise;
}

const SUPPORTED_TEXT_EXTS = new Set(['.txt', '.md', '.text']);
const PROBABLY_BINARY = new Set(['.doc', '.rtf', '.odt', '.pages']);
const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export class UnsupportedFileError extends Error {
  constructor(message: string) { super(message); this.name = 'UnsupportedFileError'; }
}

async function extractDocxText(buf: ArrayBuffer): Promise<string> {
  const { unzip } = await import('fflate');
  const u8 = new Uint8Array(buf);

  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(u8, { filter: (f) => f.name === 'word/document.xml' }, (err, out) => {
      if (err) reject(err); else resolve(out);
    });
  });

  const xmlBytes = files['word/document.xml'];
  if (!xmlBytes) {
    throw new Error('This .docx file is missing word/document.xml — it may be corrupt.');
  }

  const xml = new TextDecoder('utf-8').decode(xmlBytes);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('This .docx contains malformed XML.');
  }

  const out: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.namespaceURI === WORD_NS) {
      switch (el.localName) {
        case 't':   out.push(el.textContent ?? ''); return;
        case 'tab': out.push('\t'); return;
        case 'br':  out.push('\n'); return;
        case 'p':
          for (const c of Array.from(el.childNodes)) walk(c);
          out.push('\n');
          return;
        case 'tr':
          for (const c of Array.from(el.childNodes)) walk(c);
          out.push('\n');
          return;
        case 'tc':
          for (const c of Array.from(el.childNodes)) walk(c);
          out.push('\t');
          return;
      }
    }
    for (const c of Array.from(el.childNodes)) walk(c);
  };
  if (doc.documentElement) walk(doc.documentElement);

  return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function describePageItems(items: TextItemLike[]): { textRuns: number; charCount: number } {
  let textRuns = 0;
  let charCount = 0;
  for (const it of items) {
    if (typeof it.str === 'string' && it.str.length > 0) {
      textRuns++;
      charCount += it.str.length;
    }
  }
  return { textRuns, charCount };
}

export async function extractText(file: File): Promise<string> {
  const ext = extOf(file.name);

  if (ext === '.docx') {
    let buf: ArrayBuffer;
    try {
      buf = await file.arrayBuffer();
    } catch {
      throw new Error('Could not read the .docx file.');
    }
    let text: string;
    try {
      text = await extractDocxText(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[pdfText] docx parse failed:', e);
      throw new Error(`Could not parse .docx: ${msg}`);
    }
    if (text.length < 30) {
      throw new Error('No readable text found in this .docx file.');
    }
    return text;
  }

  if (PROBABLY_BINARY.has(ext)) {
    throw new UnsupportedFileError(
      `${ext.toUpperCase()} files aren't parsed in-browser. ` +
      `Open the file, copy the text, and paste it into the box below — ` +
      `or save / export your CV as PDF or DOCX and re-drop it.`,
    );
  }

  if (ext === '.pdf') {
    let buf: ArrayBuffer;
    try {
      buf = await file.arrayBuffer();
    } catch {
      throw new Error('Could not read the PDF file.');
    }

    let pdfjs: PdfJsModule;
    try {
      pdfjs = await getPdfJs();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Could not load the PDF parser: ${msg}`);
    }

    let doc: PdfDocument;
    try {
      doc = await pdfjs.getDocument({
        data: buf,
        useSystemFonts: true,
        isEvalSupported: false,
      }).promise;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'invalid PDF';
      console.error('[pdfText] getDocument failed:', e);
      if (/password|encrypted/i.test(msg)) {
        throw new Error('This PDF is password-protected. Remove the password and try again.');
      }
      if (/version|invalid|format/i.test(msg)) {
        throw new Error(`This file is not a valid PDF. (${msg})`);
      }
      throw new Error(`Could not open this PDF: ${msg}`);
    }

    if (!doc.numPages) {
      throw new Error('PDF has no pages.');
    }

    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages: string[] = [];
    let totalChars = 0;
    let totalRuns = 0;
    let firstPageError: string | null = null;
    let pagesProcessed = 0;
    let pagesWithText = 0;

    for (let i = 1; i <= pageCount; i++) {
      try {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const stats = describePageItems(content.items);
        totalChars += stats.charCount;
        totalRuns += stats.textRuns;
        const text = content.items
          .map(it => (typeof it.str === 'string' ? it.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) {
          pages.push(text);
          pagesWithText++;
        }
        pagesProcessed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[pdfText] page ${i} failed:`, e);
        if (!firstPageError) firstPageError = msg;
      }
    }

    const combined = pages.join('\n\n').replace(/[ \t]{3,}/g, '  ').trim();

    if (combined.length >= 30) return combined;

    // Diagnostic: if we processed pages but found no text, it's an image PDF.
    // If we got errors, surface them.
    if (pagesProcessed === 0 && firstPageError) {
      throw new Error(
        `Could not extract text from this PDF. (${firstPageError}) ` +
        `Try opening the file in a PDF reader, copying the text, and pasting it.`,
      );
    }
    if (pagesProcessed > 0 && totalRuns === 0) {
      throw new Error(
        `This PDF has no embedded text — it's a scan or an image-only export. ` +
        `Open it, select the text (if you can), copy and paste below. ` +
        `If you can't select text, run it through OCR first.`,
      );
    }
    throw new Error(
      `Got too little readable text (${totalChars} chars across ${pagesWithText}/${pagesProcessed} pages). ` +
      `Try pasting the CV text directly.`,
    );
  }

  if (SUPPORTED_TEXT_EXTS.has(ext) || file.type.startsWith('text/')) {
    const text = (await file.text()).trim();
    if (text.length < 30) throw new Error('This file is empty or too short to import.');
    return text;
  }

  throw new UnsupportedFileError(
    `Unsupported file type "${ext || file.type || 'unknown'}". Drop a PDF or paste your CV text instead.`,
  );
}
