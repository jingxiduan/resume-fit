import { authenticate, json, readBody, resolveLLM, streamLLM, consume, getUsage, quotaLimit } from '../../server/guard.mjs';
import { analyzePrompt, rewritePrompt, translatePrompt } from '../../server/prompts.mjs';

const TASKS = { analyze: analyzePrompt, rewrite: rewritePrompt, translate: translatePrompt };

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
  const auth = await authenticate(req);
  if (auth.error) return auth.error;
  try {
    const body = await readBody(req);
    const build = TASKS[body.task];
    if (!build) return json({ error: '未知任务类型' }, 400);
    if (!body.resume || String(body.resume).trim().length < 30) return json({ error: '简历内容过短' }, 400);
    if (body.task !== 'translate' && (!body.jd || String(body.jd).trim().length < 30)) return json({ error: 'JD 内容过短' }, 400);

    const cfg = resolveLLM(req);
    if (cfg.error) return json({ error: cfg.error }, 400);

    if (!cfg.byok) {
      const used = await getUsage(auth.label);
      if (used >= quotaLimit()) return json({ error: `今日 AI 额度已用完（${quotaLimit()} 次），明日自动恢复；或在设置中使用自带 Key。` }, 429);
      await consume(auth.label);
    }

    const prompt = build({
      jd: String(body.jd || '').slice(0, 20000),
      resume: String(body.resume).slice(0, 30000),
      rule: body.rule || null,
      targetLang: body.targetLang === 'zh' ? 'zh' : 'en',
      polish: body.polish !== false,
      uiLang: 'zh'
    });
    return await streamLLM(cfg, prompt);
  } catch (e) {
    return json({ error: e.message || 'AI 服务异常' }, e.status || 500);
  }
};

export const config = { path: '/api/llm' };
