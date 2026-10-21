import { authenticate, json, getUsage, quotaLimit } from '../../server/guard.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  const auth = await authenticate(req);
  if (auth.error) return auth.error;
  const used = await getUsage(auth.label);
  const llm = Boolean(process.env.LLM_API_KEY || globalThis.Netlify?.env?.get?.('LLM_API_KEY'));
  return json({ ok: true, label: auth.label, quota: { used, limit: quotaLimit() }, llm });
};

export const config = { path: '/api/verify' };
