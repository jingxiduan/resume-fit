import { createHash, timingSafeEqual } from 'node:crypto';

const env = (k, d = '') => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? d);

export const MAX_BODY = 80 * 1024;

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }
  });
}

const sha = (s) => createHash('sha256').update(String(s)).digest();

// ACCESS_CODES 格式："alice:Xk29-p0Qa-7Tzm,bob:Lm83-qq1Z-0Pva"（标签:访问码），每个接收人一个，可单独吊销
function parseCodes() {
  return env('ACCESS_CODES')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(':');
      return i > 0 ? { label: pair.slice(0, i).trim(), code: pair.slice(i + 1).trim() } : { label: 'default', code: pair };
    });
}

export function checkOrigin(req) {
  const allowed = env('ALLOWED_ORIGINS').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  if (!allowed.length) return true;
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  return allowed.some((a) => origin === a || referer.startsWith(a + '/'));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function authenticate(req) {
  if (!checkOrigin(req)) return { error: json({ error: '来源不被允许' }, 403) };
  const codes = parseCodes();
  // 未配置 ACCESS_CODES 时视为公开模式：跳过逐人鉴权，所有访问共享同一个每日额度。
  if (!codes.length) return { label: 'public' };
  const given = (req.headers.get('x-access-code') || '').trim();
  const g = sha(given);
  const hit = given && codes.find((c) => timingSafeEqual(sha(c.code), g));
  if (!hit) {
    await sleep(900);
    return { error: json({ error: '访问码无效或已被吊销' }, 401) };
  }
  return { label: hit.label };
}

export async function readBody(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) throw Object.assign(new Error('请求内容过大（上限约 80KB），请精简 JD 或简历'), { status: 413 });
  try { return JSON.parse(text || '{}'); } catch { throw Object.assign(new Error('请求格式错误'), { status: 400 }); }
}

// ---------------- 额度（Netlify Blobs，失败时退化为内存） ----------------
const mem = new Map();
let storePromise;
async function getQuotaStore() {
  if (storePromise !== undefined) return storePromise;
  storePromise = (async () => {
    try {
      const { getStore } = await import('@netlify/blobs');
      return getStore('resumefit-quota');
    } catch {
      return null;
    }
  })();
  return storePromise;
}

const today = () => new Date().toISOString().slice(0, 10);

export function quotaLimit() {
  return parseInt(env('DAILY_QUOTA', '30'), 10) || 30;
}

export async function getUsage(label) {
  const key = `${label}/${today()}`;
  const store = await getQuotaStore();
  if (store) {
    try { return parseInt((await store.get(key)) || '0', 10) || 0; } catch { /* fallthrough */ }
  }
  return mem.get(key) || 0;
}

export async function consume(label) {
  const key = `${label}/${today()}`;
  const used = (await getUsage(label)) + 1;
  const store = await getQuotaStore();
  if (store) {
    try { await store.set(key, String(used)); return used; } catch { /* fallthrough */ }
  }
  mem.set(key, used);
  return used;
}

// ---------------- LLM 调用（OpenAI 兼容接口，流式透传） ----------------
const BYOK_HOSTS = ['api.openai.com', 'api.deepseek.com', 'api.moonshot.cn', 'dashscope.aliyuncs.com', 'dashscope-intl.aliyuncs.com', 'open.bigmodel.cn', 'api.siliconflow.cn', 'generativelanguage.googleapis.com', 'openrouter.ai', 'api.groq.com', 'api.mistral.ai', 'api.together.xyz'];

export function resolveLLM(req) {
  const userKey = (req.headers.get('x-user-key') || '').trim();
  if (userKey) {
    const base = (req.headers.get('x-user-base') || 'https://api.openai.com/v1').trim().replace(/\/$/, '');
    let host;
    try {
      const u = new URL(base);
      if (u.protocol !== 'https:') throw new Error();
      host = u.hostname;
    } catch {
      return { error: '自带 Key 的 Base URL 无效（需 https）' };
    }
    if (!BYOK_HOSTS.includes(host)) return { error: `自带 Key 仅支持以下服务商：${BYOK_HOSTS.join(', ')}` };
    return { byok: true, key: userKey, base, model: (req.headers.get('x-user-model') || 'gpt-4o-mini').trim().slice(0, 80) };
  }
  const key = env('LLM_API_KEY');
  if (!key) return { error: '服务端未配置 LLM_API_KEY，可在设置中填写自带 Key' };
  return { byok: false, key, base: env('LLM_BASE_URL', 'https://api.openai.com/v1').replace(/\/$/, ''), model: env('LLM_MODEL', 'gpt-4o-mini') };
}

async function callUpstream(cfg, p, useJson) {
  const body = {
    model: cfg.model,
    messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }],
    temperature: p.temperature ?? 0.2,
    max_tokens: p.maxTokens ?? 3000,
    stream: true
  };
  if (useJson) body.response_format = { type: 'json_object' };
  return fetch(`${cfg.base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify(body)
  });
}

export async function streamLLM(cfg, p) {
  const jsonMode = p.json && env('LLM_JSON_MODE', 'on') !== 'off';
  let up = await callUpstream(cfg, p, jsonMode);
  if (!up.ok && jsonMode && (up.status === 400 || up.status === 422)) up = await callUpstream(cfg, p, false);
  if (!up.ok) {
    const t = (await up.text()).slice(0, 300);
    const status = up.status === 401 ? 502 : up.status;
    return json({ error: `模型服务返回 ${up.status}：${cfg.byok ? t : '请联系管理员检查配置'}` }, status >= 400 && status < 600 ? status : 502);
  }
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const reader = up.body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      let buf = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const j = JSON.parse(data);
              const delta = j.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(enc.encode(delta));
            } catch { /* 忽略心跳与非 JSON 行 */ }
          }
        }
      } catch (e) {
        controller.enqueue(enc.encode(`\n@@ERROR@@${e.message || 'stream error'}`));
      } finally {
        controller.close();
      }
    }
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}
