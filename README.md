# CV Builder

A lightweight, installable (PWA) CV / resume builder. Vite + Preact + TypeScript.
Three printable templates, AI ATS review, and AI-assisted CV import — all served
from a single Vercel project (static SPA + one Edge Function for the AI proxy).

## Why this stack

The previous version was a single 3,100-line HTML file. This refactor:

- Splits UI into focused, type-safe components (~200–300 LOC each).
- Uses Preact + Signals for ~5 KB of runtime instead of a full framework.
- Lazy-loads each template (CSS + JS only ships when picked).
- Loads PDF parsing on demand (pdfjs-dist, only when a PDF is dropped).
- DOCX parsing via fflate (~10 KB lazy chunk) — only loads when a `.docx` is dropped.
- Auto-saves to `localStorage`; refresh-safe.
- PWA: installable, offline cache for shell + fonts.
- Holds the DeepSeek API key inside a Vercel Edge Function — never reaches the browser.
- Eliminates the XSS risk of the original (Preact escapes children by default).

## Run locally

```bash
npm install

# 1. Set the DeepSeek key for local dev.
#    Get one at https://platform.deepseek.com/api_keys (paid; no free tier).
#    Edit .env.local at the repo root:
#      DEEPSEEK_API_KEY=sk-your-key-here
#    .env.local is gitignored — never committed.

# 2A. UI-only dev (Vite, fast HMR; AI calls fail until deployed).
npm run dev               # → http://localhost:5173

# 2B. Full local with AI working (Vercel CLI runs Vite + the Edge Function).
npm run dev:full          # → http://localhost:3000
```

`npm run dev:full` (the `vercel dev` flow) needs you to log into Vercel CLI once
(`npx vercel login`) and link the project (`npx vercel link`) — it'll prompt
on first run. After that it just works.

For day-to-day UI work, plain `npm run dev` is faster. The AI features only
need the function to succeed.

### Troubleshooting

- **AI returns 500 with "Server is missing DEEPSEEK_API_KEY":** make sure
  `.env.local` exists at the repo root and contains the key. Restart the dev
  server — env vars are read at startup.
- **AI returns 401 "auth header format should be Bearer sk-...":** the key in
  `.env.local` is wrong, expired, or has hidden whitespace. Test it:
  ```bash
  curl -H "Authorization: Bearer $(grep '^DEEPSEEK_API_KEY=' .env.local | cut -d= -f2-)" \
       https://api.deepseek.com/user/balance
  ```
- **AI returns 402 "Insufficient balance":** top up at <https://platform.deepseek.com/usage>.
- **PDF import says "no readable text":** the PDF is a scan or image-only export.
  Run it through OCR (e.g. <https://pdf24.org/ocr/>) or paste the text directly.

## Deploy to Vercel from GitHub

### One-time setup

1. **Push to GitHub.** `git init && git add . && git commit -m "init" && git push …`
2. **Import the repo into Vercel.** <https://vercel.com/new> → sign in with
   GitHub → pick the repo → click Deploy. Vercel auto-detects the Vite framework,
   sets build command `npm run build` and output directory `dist`. Don't change
   anything on the build screen.
3. **Add the secret.** After the first deploy: project → Settings →
   Environment Variables → Production → add `DEEPSEEK_API_KEY` = your `sk-…`.
4. Re-deploy from the Deployments tab so the new env var takes effect.

From now on every push to `main` triggers an auto-deploy. Branch pushes get
preview URLs at unique hostnames.

## Project layout

```
index.html
src/
  main.tsx                  entry
  app.tsx                   shell
  types.ts                  CV / AI data types
  state/
    store.ts                signals + localStorage persist + AI undo snapshot
    ai.ts                   JD/status/error signals + runAIReview action
    ui.ts                   mobile panel signal
    defaults.ts             starter data, section list
  components/
    TopBar.tsx              brand · 100% Free badge · save indicator · import · export
    BottomNav.tsx           mobile 3-tab nav (Edit / Preview / Score)
    Editor.tsx              all 15 sections of the form
    Section.tsx             collapsible header
    EntryRepeater.tsx       generic add/remove/update for any list collection
    Preview.tsx             scaled live preview
    AnalysePanel.tsx        right-column ATS panel: hero score, severity bar,
                            keyword meter, issue cards, Fix/Save/Undo footer
    ImportModal.tsx         drop zone + paste box + progress + apply
    Toast.tsx               singleton status messages
  templates/                lazy-loaded; one chunk per template
    Classic.tsx + classic.css
    Modern.tsx  + modern.css
    Minimal.tsx + minimal.css
    shared.tsx              entry / cert / award / pub / lang / ref primitives
    derive.ts               cv → ResumeData
  services/
    aiClient.ts             POST /ai/chat helpers + JSON repair + error mapping
    pdfText.ts              lazy pdfjs PDF→text + fflate DOCX→text
    print.ts                build print HTML, iframe-print w/ download fallback
  styles/
    tokens.css base.css editor.css preview.css ai.css import.css
api/
  ai/chat.ts                Vercel Edge Function — DeepSeek proxy
vercel.json                 rewrites /ai/* → /api/ai/* so client URLs stay clean
public/
  favicon.svg
legacy/
  resume_cv_generator.html  the original single-file app, archived
.env.local                  local-only secrets (gitignored)
```

## Notes

- The Edge Function lives at `api/ai/chat.ts` and is reached at the relative
  URL `/ai/chat` from the browser (`vercel.json` rewrites the path internally).
  Same-origin → no CORS preflight.
- The function rejects requests for any model not in `ALLOWED_MODELS`. Currently
  allows `deepseek-chat` (V3, default) and `deepseek-reasoner` (R1).
- DeepSeek's API is OpenAI-compatible; the client uses JSON mode
  (`response_format: { type: 'json_object' }`) and `temperature: 0` to keep the
  parser/reviewer outputs deterministic and well-formed.
- `legacy/resume_cv_generator.html` stays as a reference implementation.
