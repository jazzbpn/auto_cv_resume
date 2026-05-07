# CV Builder

A lightweight, installable (PWA) CV / resume builder. Vite + Preact + TypeScript.
Three printable templates, AI ATS review, and AI-assisted CV import — all behind
a single Cloudflare Worker that holds the **DeepSeek** API key.

## Why this stack

The previous version was a single 3,100-line HTML file. This refactor:

- Splits UI into focused, type-safe components (~200–300 LOC each).
- Uses Preact + Signals for ~5 KB of runtime instead of a full framework.
- Lazy-loads each template (CSS + JS only ships when picked).
- Loads PDF parsing on demand (pdfjs-dist, only when a PDF is dropped).
- Auto-saves to `localStorage`; refresh-safe.
- PWA: installable, offline cache for shell + fonts.
- Moves the DeepSeek API key out of the browser into a Cloudflare Worker.
- Eliminates the XSS risk of the original (Preact escapes children by default).

## Run locally

```bash
npm install

# 1. Set the DeepSeek key for local dev.
#    Get one at https://platform.deepseek.com/api_keys (paid; no free tier).
#    Edit worker/.dev.vars and put your key on the empty line:
#      DEEPSEEK_API_KEY=sk-your-key-here
#    .dev.vars is gitignored — your key never leaves the repo locally.

# 2. Start the Worker (handles AI calls).
npm run worker:dev          # → http://localhost:8787

# 3. Start the app (Vite proxies /ai/* → localhost:8787).
npm run dev                 # → http://localhost:5173
```

Without the worker, the editor / preview / export still work — only the AI Review
and AI Import buttons need it.

### Troubleshooting

- **AI Review / Import returns 401 with "Worker is missing DEEPSEEK_API_KEY":**
  if you started `wrangler dev` *before* writing your key into `worker/.dev.vars`,
  Miniflare may have bound the variable to an empty string and not picked up the
  edit on hot reload. **Fully stop and restart `npm run worker:dev`** (Ctrl+C →
  re-run). Re-running is enough; you don't need to re-install or rebuild.
- **AI Review / Import returns 402 "Insufficient balance":** top up your
  DeepSeek account at <https://platform.deepseek.com/usage>. There is no free tier.
- **PDF import says "no readable text":** the PDF is a scan or an
  image-only export. Run it through OCR (e.g. <https://pdf24.org/ocr/>) and
  re-drop the OCR'd PDF, or paste the text directly.

### Deploying to Cloudflare

For production deployment, store the secret in Cloudflare instead of `.dev.vars`:

```bash
npx wrangler secret put DEEPSEEK_API_KEY --config worker/wrangler.toml
# paste the sk-... key when prompted
```

## Build & deploy

```bash
npm run build               # → dist/
npm run worker:deploy       # → Cloudflare
```

If your worker is on a different origin from your static site, set:

```env
VITE_AI_PROXY_URL=https://cv-maker-ai-proxy.<account>.workers.dev/ai
```

## Project layout

```
src/
  main.tsx                  entry
  app.tsx                   shell (top bar / nav / modal mount)
  types.ts                  CV / AI data types
  state/
    store.ts                signals + localStorage persist
    defaults.ts             starter data, section list
  components/
    TopBar.tsx              brand · template select · import · export
    BottomNav.tsx           mobile edit/preview switch
    Editor.tsx              all 15 sections of the form
    Section.tsx             collapsible header
    EntryRepeater.tsx       generic add/remove/update for any list collection
    Preview.tsx             scaled preview + sub-tabs (CV / AI)
    AIPanel.tsx             review controls + score ring + issues
    ImportModal.tsx         drop zone + paste box + progress + apply
    Toast.tsx               singleton status messages
  templates/
    index.ts                lazy registry
    Classic.tsx + classic.css
    Modern.tsx  + modern.css
    Minimal.tsx + minimal.css
    shared.tsx              entry / cert / award / pub / lang / ref primitives
    derive.ts               cv → ResumeData (+ AI overrides)
  services/
    aiClient.ts             POST /ai/messages helpers + JSON repair
    pdfText.ts              lazy pdfjs PDF→text
    print.ts                build print HTML, iframe print w/ download fallback
  styles/
    tokens.css base.css editor.css preview.css ai.css import.css
worker/
  index.ts                  CORS-aware Anthropic proxy
  wrangler.toml
legacy/
  resume_cv_generator.html  the original single-file app, archived
```

## What changed vs the original

| Concern | Before | After |
|---|---|---|
| Auth | API key missing — AI features never worked | Worker proxy holds key, model allow-list, body-size cap |
| XSS | All fields injected via `innerHTML` | Preact JSX escapes by default |
| Code dup | `applyAISuggestions` defined twice; renderer duplicated for AI preview | Single template path, AI is a `summaryOverride` / `expOverrides` flag |
| CSS dup | Print HTML reinjected ~500 LOC of UI-only CSS into every download | Print collects only resolved stylesheet rules |
| PDF parse | Read raw bytes & kept printable ASCII (broken on real PDFs) | pdfjs-dist, lazy-loaded only when needed |
| Persistence | None — refresh wipes everything | Debounced `localStorage` |
| Offline | None | Service Worker via vite-plugin-pwa |
| Templates | All 3 stylesheets shipped on first paint | Lazy chunk per template |
| Bundle | ~136 KB single file (uncompressed) | Initial JS ≈ 25 KB gzipped, lazy templates ≈ 2 KB each |

## Notes

- DOCX parsing is intentionally out of scope for the lightweight bundle — the
  modal still accepts dropped `.txt` and PDFs, plus pasted text. Adding mammoth.js
  for DOCX would add ~120 KB; revisit only if users need it.
- `legacy/resume_cv_generator.html` stays as a reference implementation.
- The Worker rejects requests for any model not in `ALLOWED_MODELS` (see
  `worker/index.ts`); update that set when newer models are released. Currently
  allows `deepseek-chat` (V3, default) and `deepseek-reasoner` (R1).
- DeepSeek's API is OpenAI-compatible; the client uses JSON mode
  (`response_format: { type: 'json_object' }`) and `temperature: 0` to keep the
  parser/reviewer outputs deterministic and well-formed.
# auto_cv_resume
