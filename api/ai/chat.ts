/**
 * Vercel Edge Function — POST /api/ai/chat
 *
 * The browser calls /ai/chat (see vercel.json rewrites). This file proxies
 * to DeepSeek's chat completions endpoint, holding the API key out of
 * client-side code.
 *
 * Edge runtime: uses standard Web APIs (Request, Response, fetch). Env
 * vars come from process.env, populated by Vercel's project env vars in
 * production, or .env.local during `vercel dev`.
 */

export const config = { runtime: 'edge' };

const ALLOWED_MODELS = new Set([
  'deepseek-chat',      // DeepSeek-V3 — general purpose
  'deepseek-reasoner',  // DeepSeek-R1 — reasoning (slower)
]);
const MAX_BODY_BYTES = 64 * 1024;

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return jsonError(405, 'Method not allowed');

  const cl = Number(request.headers.get('Content-Length') ?? '0');
  if (cl && cl > MAX_BODY_BYTES) return jsonError(413, 'Request body too large');

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  const model = typeof body.model === 'string' ? body.model : '';
  if (!ALLOWED_MODELS.has(model)) {
    return jsonError(400, `Model not allowed. Use one of: ${[...ALLOWED_MODELS].join(', ')}`);
  }

  const key = (process.env.DEEPSEEK_API_KEY ?? '').trim();
  if (!key.startsWith('sk-')) {
    return jsonError(
      500,
      'Server is missing DEEPSEEK_API_KEY. Set it in Vercel → Project → Settings → ' +
      'Environment Variables (Production), or in `.env.local` for local dev.',
    );
  }

  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
