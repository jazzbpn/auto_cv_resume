import { defineConfig, loadEnv, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

const ALLOWED_MODELS = new Set(['deepseek-chat', 'deepseek-reasoner']);

/**
 * Dev-only middleware: handles POST /ai/chat by proxying to DeepSeek using
 * DEEPSEEK_API_KEY from .env.local. Mirrors api/ai/chat.ts so `npm run dev`
 * works without needing `vercel dev`.
 */
function aiDevProxy(apiKey: string): Plugin {
  return {
    name: 'ai-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/ai/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: 'Method not allowed' } }));
          return;
        }
        if (!apiKey.startsWith('sk-')) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: 'DEEPSEEK_API_KEY missing in .env.local' } }));
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString('utf8');
        let body: Record<string, unknown>;
        try { body = JSON.parse(raw) as Record<string, unknown>; }
        catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: 'Invalid JSON' } }));
          return;
        }
        const model = typeof body.model === 'string' ? body.model : '';
        if (!ALLOWED_MODELS.has(model)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: `Model not allowed. Use one of: ${[...ALLOWED_MODELS].join(', ')}` } }));
          return;
        }
        try {
          const upstream = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
          const text = await upstream.text();
          res.end(text);
        } catch (e) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: `Upstream fetch failed: ${e instanceof Error ? e.message : String(e)}` } }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = (env.DEEPSEEK_API_KEY ?? '').trim();
  return {
  plugins: [
    aiDevProxy(apiKey),
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'CV Builder',
        short_name: 'CV',
        description: 'Lightweight CV / resume builder with AI ATS review.',
        theme_color: '#1a1510',
        background_color: '#2c2620',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Don't cache the AI endpoint — every call should hit the live function.
        navigateFallbackDenylist: [/^\/ai\//],
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'gfont-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gfont-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          preact: ['preact', 'preact/hooks', '@preact/signals'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // /ai/chat is handled in-process by the aiDevProxy plugin above using
    // DEEPSEEK_API_KEY from .env.local — no separate dev server required.
  },
  };
});
