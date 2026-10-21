import { authenticate, json, readBody } from '../../server/guard.mjs';
import { scoreResume } from '../../server/engine.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  const auth = await authenticate(req);
  if (auth.error) return auth.error;
  try {
    const { jd, resume, role, meta } = await readBody(req);
    if (!jd || !resume || String(jd).trim().length < 30 || String(resume).trim().length < 30) {
      return json({ error: 'JD 与简历内容均不能少于 30 个字符' }, 400);
    }
    return json(scoreResume({ jd, resume, role, meta }));
  } catch (e) {
    return json({ error: e.message || '评分失败' }, e.status || 500);
  }
};

export const config = { path: '/api/score' };
