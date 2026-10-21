(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const CJK_G = /[\u4e00-\u9fff]/g;
  const BULLET = /^[\s•·▪●◦►▶■□✓✔➢\-–*+]+/;

  const state = {
    code: localStorage.getItem('rf_code') || '',
    byok: JSON.parse(localStorage.getItem('rf_byok') || 'null'),
    llmAvailable: false,
    rule: null,
    ai: null,
    rewrite: null,
    meta: {},
    busy: false
  };

  const PRESETS = {
    openai: ['https://api.openai.com/v1', 'gpt-4o-mini'],
    deepseek: ['https://api.deepseek.com/v1', 'deepseek-chat'],
    qwen: ['https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-plus'],
    moonshot: ['https://api.moonshot.cn/v1', 'moonshot-v1-32k'],
    zhipu: ['https://open.bigmodel.cn/api/paas/v4', 'glm-4-flash'],
    siliconflow: ['https://api.siliconflow.cn/v1', 'Qwen/Qwen2.5-72B-Instruct'],
    openrouter: ['https://openrouter.ai/api/v1', 'openai/gpt-4o-mini'],
    gemini: ['https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-2.0-flash']
  };

  // ---------------- 工具函数 ----------------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const markPh = (s) => esc(s).replace(/\[[^\]\n]{1,24}\]/g, (m) => `<mark>${m}</mark>`);
  const cjkRatio = (t) => { const s = String(t).replace(/\s/g, ''); return s.length ? (s.match(CJK_G) || []).length / s.length : 0; };
  const langOf = (t) => (cjkRatio(t) > 0.15 ? 'zh' : 'en');
  const colorOf = (v) => (v >= 85 ? 'var(--green)' : v >= 70 ? 'var(--lime)' : v >= 55 ? 'var(--amber)' : 'var(--red)');

  let toastTimer;
  function toast(msg, isErr = false, ms = 3200) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast' + (isErr ? ' error' : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), ms);
  }

  function openModal(id) { $(id).hidden = false; }
  function closeModal(el) { el.hidden = true; }

  function download(name, text, type = 'text/plain') {
    const blob = new Blob([text], { type: type + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('已复制'); }
    catch { toast('复制失败，请手动选择复制', true); }
  }

  function parseLoose(s) {
    let t = String(s).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('AI 返回内容无法解析，请重试');
    t = t.slice(a, b + 1);
    try { return JSON.parse(t); }
    catch {
      try { return JSON.parse(t.replace(/,\s*([}\]])/g, '$1')); }
      catch { throw new Error('AI 返回的 JSON 不完整（可能被截断），请重试或换用更大上下文的模型'); }
    }
  }

  // ---------------- 隐私脱敏（浏览器本地完成） ----------------
  function redact(text) {
    const n = { 姓名: 0, 邮箱: 0, 电话: 0, 证件号: 0, 主页ID: 0, 社交账号: 0, 地址: 0, 生日: 0 };
    let t = String(text);
    t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, () => { n.邮箱++; return '[EMAIL]'; });
    t = t.replace(/(^|[^\w])(\d{17}[\dXx])(?![\w])/g, (m, p) => { n.证件号++; return p + '[ID]'; });
    t = t.replace(/(github\.com|gitlab\.com|huggingface\.co|kaggle\.com|linkedin\.com\/in|zhihu\.com\/people|leetcode\.(?:com|cn)\/(?:u\/)?)\/?([A-Za-z0-9_\-.%]+)/gi, (m, h) => { n.主页ID++; return h.replace(/\/$/, '') + '/[REDACTED]'; });
    t = t.replace(/(scholar\.google\.[a-z.]+\/citations\?user=)([\w-]+)/gi, (m, h) => { n.主页ID++; return h + '[REDACTED]'; });
    t = t.replace(/(微信|wechat|weixin|vx|qq)\s*[:：]?\s*[A-Za-z0-9_\-]{5,}/gi, (m, h) => { n.社交账号++; return h + ': [REDACTED]'; });
    t = t.replace(/(^|[^\w])(\+?\d[\d\s\-()]{8,18}\d)(?![\w])/g, (m, p, num) => {
      const d = num.replace(/\D/g, '');
      if (d.length < 10 || d.length > 15) return m;
      if (/^(19|20)\d{2,4}\s*[-–~]\s*(19|20)\d{2,4}$/.test(num.trim())) return m;
      n.电话++;
      return p + '[PHONE]';
    });
    t = t.replace(/(地址|住址|家庭住址|address)\s*[:：]\s*[^\n|]+/gi, (m, h) => { n.地址++; return h + ': [ADDRESS]'; });
    t = t.replace(/(出生日期|出生年月|生日|date of birth|dob)\s*[:：]?\s*[^\n|]+/gi, (m, h) => { n.生日++; return h + ': [DOB]'; });
    t = t.replace(/(姓\s*名|name)\s*[:：]\s*[^\n|,，]{1,30}/gi, (m, h) => { n.姓名++; return h + ': [NAME]'; });

    const lines = t.split('\n');
    const idx = lines.findIndex((l) => l.trim());
    if (idx >= 0) {
      const parts = lines[idx].split(/\s*[|｜·•,，]\s*/);
      const first = parts[0].trim();
      const looksZh = /^[\u4e00-\u9fff]{2,4}$/.test(first);
      const looksEn = /^([A-Z][a-zA-Z'\-]+)(\s+[A-Z][a-zA-Z'\-.]+){1,3}$/.test(first) && first.length < 40 && !/(resume|curriculum|engineer|scientist|developer)/i.test(first);
      if (looksZh || looksEn) {
        parts[0] = '[NAME]';
        lines[idx] = parts.join(' | ');
        n.姓名++;
      }
    }
    return { text: lines.join('\n'), stat: n };
  }

  const preparedResume = () => ($('#redact').checked ? redact($('#resume').value).text : $('#resume').value);

  // ---------------- 文件解析（本地） ----------------
  function loadScript(src) {
    return new Promise((res, rej) => {
      if ([...document.scripts].some((s) => s.src === src)) return res();
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error('解析组件加载失败，请检查网络'));
      document.head.appendChild(s);
    });
  }
  const VENDOR = new URL('vendor/', location.href).href;
  const PDFJS = VENDOR + 'pdf.min.js';
  const PDFJS_WORKER = VENDOR + 'pdf.worker.min.js';
  const MAMMOTH = VENDOR + 'mammoth.browser.min.js';

  async function parsePDF(buf) {
    await loadScript(PDFJS);
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const pdf = await lib.getDocument({ data: buf, cMapUrl: VENDOR + 'cmaps/', cMapPacked: true, isEvalSupported: false }).promise;
    const out = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      let cur = '';
      let lastY = null;
      let lastXEnd = null;
      const lines = [];
      for (const it of content.items) {
        if (!('str' in it)) continue;
        const [a, b, , , x, y] = it.transform;
        const fs = Math.hypot(a, b) || 10;
        if (lastY !== null && Math.abs(y - lastY) > fs * 0.45) { lines.push(cur); cur = ''; lastXEnd = null; }
        if (lastXEnd !== null && it.str) {
          const gap = x - lastXEnd;
          if (gap > fs * 3) cur += '    ';
          else if (gap > fs * 0.22 && !/\s$/.test(cur)) cur += ' ';
        }
        cur += it.str;
        lastY = y;
        lastXEnd = x + (it.width || 0);
        if (it.hasEOL) { lines.push(cur); cur = ''; lastY = null; lastXEnd = null; }
      }
      if (cur) lines.push(cur);
      out.push(lines.map((l) => l.replace(/\s+$/, '')).join('\n'));
    }
    return { text: out.join('\n\n'), pages: pdf.numPages };
  }

  async function parseDOCX(buf) {
    await loadScript(MAMMOTH);
    const r = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return { text: r.value, pages: null };
  }

  async function handleFile(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast('文件超过 8MB', true);
    const name = file.name.toLowerCase();
    toast('正在本地解析文件…');
    try {
      let r;
      if (name.endsWith('.pdf')) r = await parsePDF(await file.arrayBuffer());
      else if (name.endsWith('.docx')) r = await parseDOCX(await file.arrayBuffer());
      else r = { text: await file.text(), pages: null };
      const text = r.text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
      $('#resume').value = text;
      state.meta = { source: name.split('.').pop(), pages: r.pages };
      updateCounts();
      if (text.replace(/\s/g, '').length < 300) toast('提取到的文字很少：这通常意味着 PDF 是图片/扫描件，ATS 同样无法读取。', true, 6000);
      else toast(`解析完成：${text.length} 字${r.pages ? `，${r.pages} 页` : ''}`);
    } catch (e) {
      toast('解析失败：' + e.message, true);
    }
  }

  // ---------------- API ----------------
  function headers(withKey) {
    const h = { 'content-type': 'application/json', 'x-access-code': state.code };
    if (withKey && state.byok?.key) {
      h['x-user-key'] = state.byok.key;
      h['x-user-base'] = state.byok.base;
      h['x-user-model'] = state.byok.model;
    }
    return h;
  }

  async function handleErr(res) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { logout(); showGate(data.error || '访问码无效'); }
    throw new Error(data.error || `请求失败（HTTP ${res.status}）`);
  }

  async function apiJSON(path, body) {
    const res = await fetch(path, { method: 'POST', headers: headers(false), body: JSON.stringify(body || {}) });
    if (!res.ok) await handleErr(res);
    return res.json();
  }

  async function apiStream(body, onProgress) {
    const res = await fetch('/api/llm', { method: 'POST', headers: headers(true), body: JSON.stringify(body) });
    if (!res.ok) await handleErr(res);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let out = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      out += dec.decode(value, { stream: true });
      onProgress && onProgress(out);
    }
    const ei = out.indexOf('@@ERROR@@');
    if (ei >= 0) throw new Error('AI 流中断：' + out.slice(ei + 9));
    refreshQuota();
    return out;
  }

  const aiReady = () => state.llmAvailable || Boolean(state.byok?.key);

  function slimRule(r) {
    if (!r) return null;
    return {
      role: r.role,
      scores: r.scores,
      missingKeywords: r.missingKeywords,
      knockouts: (r.knockouts || []).map((k) => ({ name: k.name, status: k.status })),
      quality: { weak: (r.quality?.weak || []).map((w) => ({ phrase: w.phrase })) }
    };
  }

  // ---------------- 访问码 ----------------
  function showGate(msg = '') {
    $('#gateErr').textContent = msg;
    openModal('#gate');
    setTimeout(() => $('#gateCode').focus(), 50);
  }

  function logout() {
    state.code = '';
    localStorage.removeItem('rf_code');
    $('#quotaPill').textContent = '未验证';
    $('#quotaPill').classList.remove('ok');
  }

  async function verify(code) {
    const res = await fetch('/api/verify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-access-code': code } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '验证失败');
    return data;
  }

  function renderQuota(d) {
    state.llmAvailable = d.llm;
    const pill = $('#quotaPill');
    pill.classList.add('ok');
    pill.textContent = state.byok?.key ? `已验证 · 自带 Key` : d.llm ? `已验证 · AI 额度 ${Math.max(0, d.quota.limit - d.quota.used)}/${d.quota.limit}` : '已验证 · 仅规则评分';
  }

  async function refreshQuota() {
    try { renderQuota(await verify(state.code)); } catch { /* 忽略 */ }
  }

  // ---------------- 分析 ----------------
  function validateInputs() {
    const jd = $('#jd').value.trim();
    const rs = $('#resume').value.trim();
    if (jd.length < 30) { toast('请先粘贴完整 JD', true); $('#jd').focus(); return null; }
    if (rs.length < 30) { toast('请先上传或粘贴简历', true); $('#resume').focus(); return null; }
    if (!state.code) { showGate(); return null; }
    return { jd, resume: preparedResume() };
  }

  function setBusy(b, label) {
    state.busy = b;
    ['#btnAnalyze', '#btnRewrite', '#btnTranslate'].forEach((s) => ($(s).disabled = b));
    $('#btnAnalyze').textContent = b && label ? label : '一键分析适配度';
  }

  async function analyze({ allowAutoRewrite = true } = {}) {
    if (state.busy) return;
    const input = validateInputs();
    if (!input) return;
    setBusy(true, '规则评分中…');
    state.ai = null;
    try {
      const rule = await apiJSON('/api/score', { jd: input.jd, resume: input.resume, role: $('#role').value, meta: state.meta });
      state.rule = rule;
      $('#results').hidden = false;
      renderAll();
      $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });

      if ($('#useAI').checked && aiReady()) {
        setBusy(true, 'AI 评估中…');
        renderPanelLoading('AI 评估中…');
        try {
          const txt = await apiStream({ task: 'analyze', jd: input.jd, resume: input.resume, rule: slimRule(rule) }, (s) => renderPanelLoading(`AI 评估中… 已接收 ${s.length} 字符`));
          state.ai = parseLoose(txt);
        } catch (e) {
          toast(e.message, true, 5000);
        }
        renderAll();
      }

      const th = parseInt($('#threshold').value, 10) || 85;
      if (allowAutoRewrite && $('#autoRewrite').checked && finalScore() < th) {
        if (aiReady()) {
          toast(`适配度 ${finalScore()} < ${th}，已为你打开改写窗口`);
          openRewrite(true);
        } else {
          toast(`适配度 ${finalScore()} < ${th}。配置 AI 后可自动生成改写。`, false, 5000);
        }
      }
    } catch (e) {
      toast(e.message, true, 5000);
    } finally {
      setBusy(false);
    }
  }

  function finalScore() {
    const r = state.rule;
    if (!r) return 0;
    let s = r.scores.overall;
    if (state.ai && Number.isFinite(+state.ai.semantic_score)) s = Math.round(r.scores.overall * 0.6 + Math.max(0, Math.min(100, +state.ai.semantic_score)) * 0.4);
    if (r.ats.some((i) => i.level === 'critical')) s = Math.min(s, 59);
    return s;
  }

  // ---------------- 渲染 ----------------
  function bar(label, v, w) {
    const val = v == null ? null : Math.round(v);
    return `<div class="bar"><div class="bar-top"><span>${esc(label)}${w ? `<span class="w">${esc(w)}</span>` : ''}</span><b>${val == null ? '—' : val}</b></div><div class="bar-track"><div class="bar-fill" data-w="${val ?? 0}" style="background:${colorOf(val ?? 0)}"></div></div></div>`;
  }
  function animateBars(root) {
    requestAnimationFrame(() => root.querySelectorAll('.bar-fill').forEach((el) => (el.style.width = el.dataset.w + '%')));
  }

  function renderAll() {
    const r = state.rule;
    const ai = state.ai;
    const score = finalScore();
    const C = 326.73;
    $('#ringFg').style.strokeDashoffset = String(C * (1 - score / 100));
    $('#ringFg').style.stroke = colorOf(score);
    $('#scoreNum').textContent = score;

    let level = r.pass.level;
    if (ai && ai.verdict === 'no' && level === 'high') level = 'medium';
    const passName = { high: '高', medium: '中', low: '低' }[level];
    const pb = $('#passBadge');
    pb.className = 'pass ' + level;
    pb.textContent = `机筛通过概率：${passName}`;
    $('#roleLabel').textContent = `识别岗位：${r.role.label} · JD ${r.lang.jd === 'en' ? '英文' : '中文'} / 简历 ${r.lang.resume === 'en' ? '英文' : '中文'}`;
    $('#passReasons').innerHTML = r.pass.reasons.map((x) => `<li>${esc(x)}</li>`).join('');
    $('#scoreFormula').textContent = ai ? `综合分 = 规则分 ${r.scores.overall} × 0.6 + AI 语义分 ${ai.semantic_score} × 0.4` : `综合分 = 规则引擎分（未启用 AI 语义评估）`;

    $('#bars').innerHTML = [
      bar('关键词匹配（ATS 字面命中）', r.scores.keyword, '40%'),
      bar('硬性门槛（年限 / 学历 / 语言 / 论文）', r.scores.knockout, '15%'),
      bar('STAR 表述质量', r.scores.quality, '20%'),
      bar('ATS 可解析性', r.scores.ats, '15%'),
      bar('岗位加分信号', r.scores.signals, '10%'),
      bar('AI 语义匹配（用人经理视角）', ai ? ai.semantic_score : null, ai ? '融合 40%' : '未启用')
    ].join('');
    animateBars($('#bars'));

    const lb = $('#langBanner');
    if (r.lang.jd !== r.lang.resume) {
      lb.hidden = false;
      $('#langBannerText').textContent = r.lang.jd === 'en'
        ? 'JD 为英文、简历为中文。海外 ATS 按英文字面匹配，建议先转换为英文学术化表述再投递。'
        : 'JD 为中文、简历为英文。国内团队初筛建议使用中文版本。';
      $('#btnBannerTranslate').dataset.lang = r.lang.jd;
    } else lb.hidden = true;

    renderActions(r, ai);
    renderKeywords(r);
    renderKnockouts(r);
    renderAts(r);
    renderQuality(r);
    renderPanel(ai);
    renderInterview(ai);
    renderForm(r);
  }

  function renderActions(r, ai) {
    const items = [...r.suggestions];
    if (ai?.gaps) ai.gaps.filter((g) => g.severity === 'critical').slice(0, 3).forEach((g) => items.push({ p: 'P0', text: `【用人经理】${g.requirement}：${g.suggestion}` }));
    if (finalScore() < (parseInt($('#threshold').value, 10) || 85)) items.push({ p: 'P1', text: '点击"生成匹配 JD 的改写"，获取逐条 STAR 改写与可直接粘贴的 Skills 段。' });
    items.sort((a, b) => a.p.localeCompare(b.p));
    $('#paneActions').innerHTML = items.length
      ? `<ul class="list">${items.map((s) => `<li class="item"><div class="t"><span class="lv ${esc(s.p)}">${esc(s.p)}</span>${esc(s.text)}</div></li>`).join('')}</ul>`
      : '<div class="empty">没有发现明显问题，可以投递。</div>';
  }

  function chips(list, jdLang) {
    if (!list.length) return '<span class="muted sm">无</span>';
    return list.map((k) => {
      let cls = k.matched ? 'ok' : 'miss';
      let tip = '';
      if (k.matched && k.literal === false && jdLang === 'en') { cls = 'warn'; tip = '（仅中文出现）'; }
      return `<span class="chip ${cls}" title="${esc(k.cat || '')}">${esc(k.label)}${tip}</span>`;
    }).join('');
  }

  function renderKeywords(r) {
    const k = r.keywords;
    const cnt = (l) => `${l.filter((x) => x.matched).length}/${l.length}`;
    const missing = r.missingKeywords || [];
    $('#paneKeywords').innerHTML = `
      <div class="section-title">必备 / 职责关键词 <span class="muted sm">${cnt(k.must)} 命中 · 权重高</span></div>
      <div class="chips">${chips(k.must, r.lang.jd)}</div>
      <div class="section-title">加分关键词 <span class="muted sm">${cnt(k.nice)} 命中</span></div>
      <div class="chips">${chips(k.nice, r.lang.jd)}</div>
      <div class="section-title">JD 中的其他技术词 <span class="muted sm">${cnt(k.extra)} 命中 · 低权重</span></div>
      <div class="chips">${chips(k.extra, r.lang.jd)}</div>
      ${missing.length ? `<div class="row" style="margin-top:12px"><button class="btn sm" id="copyMissing" type="button">复制缺失关键词</button><span class="muted sm">仅补充你真实具备的技能；关键词堆砌会被 HR 与部分 ATS 识别为 keyword stuffing。</span></div>` : ''}
      <div class="section-title">岗位加分信号</div>
      <div class="chips">${r.signals.map((s) => `<span class="chip ${s.found ? 'ok' : 'miss'}">${esc(s.name)}${s.detail ? '：' + esc(s.detail) : ''}</span>`).join('')}</div>`;
    const btn = $('#copyMissing');
    if (btn) btn.onclick = () => copy(missing.join(', '));
  }

  function renderKnockouts(r) {
    const st = { pass: '通过', warn: '存疑', fail: '未通过', unknown: '未识别' };
    $('#paneKnockouts').innerHTML = r.knockouts.length
      ? `<table class="tbl"><thead><tr><th>项目</th><th>JD 要求</th><th>简历识别结果</th><th>状态</th><th>说明</th></tr></thead><tbody>${r.knockouts.map((k) => `<tr><td>${esc(k.name)}</td><td>${esc(k.required)}</td><td>${esc(k.candidate)}</td><td><span class="lv ${esc(k.status)}">${st[k.status]}</span></td><td class="muted">${esc(k.note || '')}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">JD 中未识别到明确的年限 / 学历 / 语言 / 论文要求。</div>';
  }

  function renderAts(r) {
    const name = { critical: '致命', major: '主要', minor: '次要' };
    $('#paneAts').innerHTML = r.ats.length
      ? `<ul class="list">${r.ats.map((i) => `<li class="item"><div class="t"><span class="lv ${i.level}">${name[i.level]}</span>${esc(i.title)}</div><div class="d">${esc(i.detail)}</div><div class="f">${esc(i.fix)}</div></li>`).join('')}</ul>`
      : '<div class="empty">未发现 ATS 解析问题。</div>';
    $('#paneAts').insertAdjacentHTML('beforeend', `<p class="muted sm" style="margin-top:12px">已识别段落：${r.sectionsFound.length ? r.sectionsFound.map(esc).join(' / ') : '无'}。提示：页眉页脚、文本框、表格中的内容在 Workday / Taleo / Greenhouse 等系统中常被丢弃。</p>`);
  }

  function renderQuality(r) {
    const q = r.quality;
    const pct = (x) => Math.round(x * 100) + '%';
    $('#paneQuality').innerHTML = `
      <div class="stats">
        <div class="stat"><div class="v">${q.bullets}</div><div class="k">识别到的经历要点</div></div>
        <div class="stat"><div class="v" style="color:${colorOf(q.quantRatio * 100)}">${pct(q.quantRatio)}</div><div class="k">含量化结果（R）</div></div>
        <div class="stat"><div class="v" style="color:${colorOf(q.verbRatio * 100)}">${pct(q.verbRatio)}</div><div class="k">强动词开头（A）</div></div>
        <div class="stat"><div class="v" style="color:${colorOf(q.starAvg * 100)}">${pct(q.starAvg)}</div><div class="k">STAR 完整度</div></div>
      </div>
      <div class="section-title">口语化 / 弱表述 <span class="muted sm">${q.weak.length} 类</span></div>
      ${q.weak.length ? `<table class="tbl"><thead><tr><th style="width:150px">表述</th><th>出现位置</th><th style="width:34%">替换建议</th></tr></thead><tbody>${q.weak.map((w) => `<tr><td><span class="lv major">${esc(w.phrase)}</span></td><td class="muted">${esc(w.line)}</td><td>${esc(w.fix)}</td></tr>`).join('')}</tbody></table>` : '<div class="muted sm">未发现</div>'}
      <div class="section-title">缺少量化结果的要点</div>
      ${q.unquantified.length ? `<ul class="list">${q.unquantified.map((b) => `<li class="item"><div class="d">${esc(b)}</div></li>`).join('')}</ul>` : '<div class="muted sm">全部要点均含量化结果</div>'}
      ${q.longBullets.length ? `<div class="section-title">过长要点（建议拆分或压缩到两行内）</div><ul class="list">${q.longBullets.map((b) => `<li class="item"><div class="d">${esc(b)}</div></li>`).join('')}</ul>` : ''}
      <div class="section-title">STAR 参考句式</div>
      <div class="two">
        <div class="quote">Designed and deployed a [method] for [scenario/problem] using [tech stack], improving [metric] by [X%] and reducing [cost/latency] by [Y].</div>
        <div class="quote">针对 [业务场景] 中的 [问题]，提出并落地 [方法 / 模型]，基于 [技术栈] 实现 [关键动作]，使 [核心指标] 提升 [X%]。</div>
      </div>`;
  }

  function renderPanelLoading(text) {
    $('#panePanel').innerHTML = `<div class="progress"><div class="spinner"></div><span>${esc(text)}</span></div>`;
  }

  function renderPanel(ai) {
    if (!ai) {
      $('#panePanel').innerHTML = `<div class="empty">${aiReady() ? '勾选"启用 AI 语义评估"后重新分析即可查看 HR 与用人经理视角。' : '服务端未配置模型，可在右上角"设置"中填写自带 Key。'}</div>`;
      return;
    }
    const vName = { strong_yes: '强烈推荐面试', yes: '推荐面试', maybe: '待定', no: '不推荐' };
    const vCls = { strong_yes: 'pass', yes: 'pass', maybe: 'warn', no: 'fail' };
    const fitName = { under: '级别偏低', match: '级别匹配', over: '级别偏高' };
    const d = ai.dimensions || {};
    const sev = { critical: '致命', major: '主要', minor: '次要' };
    $('#panePanel').innerHTML = `
      <div class="row" style="margin-bottom:10px">
        <span class="lv ${vCls[ai.verdict] || 'unknown'}" style="font-size:12.5px;padding:3px 12px">${esc(vName[ai.verdict] || ai.verdict || '-')}</span>
        ${ai.seniority ? `<span class="muted sm">JD 级别：${esc(ai.seniority.jd_level)} · 候选人：${esc(ai.seniority.candidate_level)} · ${esc(fitName[ai.seniority.fit] || ai.seniority.fit)}${ai.seniority.note ? ' · ' + esc(ai.seniority.note) : ''}</span>` : ''}
      </div>
      <div class="two">
        <div>
          <div class="section-title">HR 6 秒初筛结论</div><div class="quote">${esc(ai.hr_view)}</div>
          <div class="section-title">用人经理结论</div><div class="quote">${esc(ai.hm_view)}</div>
        </div>
        <div class="mini-bars">
          <div class="section-title">能力维度</div>
          ${bar('技术深度', d.technical_depth)}${bar('领域相关性', d.domain_relevance)}${bar('影响力证据', d.impact_evidence)}${bar('工程严谨性', d.engineering_rigor)}${bar('表达与沟通', d.communication)}
        </div>
      </div>
      <div class="section-title">与 JD 对齐的优势</div>
      <ul class="list">${(ai.strengths || []).map((s) => `<li class="item"><div class="t">${esc(s.point)}</div><div class="d muted">${esc(s.evidence)}</div></li>`).join('')}</ul>
      <div class="section-title">差距与补齐方式</div>
      <ul class="list">${(ai.gaps || []).map((g) => `<li class="item"><div class="t"><span class="lv ${esc(g.severity)}">${sev[g.severity] || esc(g.severity)}</span>${esc(g.requirement)}</div><div class="f">${esc(g.suggestion)}</div></li>`).join('')}</ul>
      ${(ai.red_flags || []).length ? `<div class="section-title">风险信号</div><ul class="list">${ai.red_flags.map((f) => `<li class="item"><div class="d">${esc(f)}</div></li>`).join('')}</ul>` : ''}`;
    animateBars($('#panePanel'));
  }

  function renderInterview(ai) {
    $('#paneInterview').innerHTML = ai?.interview_questions?.length
      ? `<ul class="list">${ai.interview_questions.map((q, i) => `<li class="item"><div class="t">Q${i + 1}. ${esc(q.q)}</div><div class="d muted">考察点：${esc(q.intent)}</div></li>`).join('')}</ul>`
      : '<div class="empty">启用 AI 语义评估后，将基于简历与 JD 的差距预测面试问题。</div>';
  }

  function renderForm(r) {
    $('#paneForm').innerHTML = `<p class="muted sm" style="margin-top:0">很多简历不是被 ATS 打分卡掉，而是被投递表单中的 knockout 问题直接过滤。以下是根据该 JD 预测的硬性问题：</p>
      <ul class="list">${r.formQuestions.map((q) => `<li class="item"><div class="d">${esc(q)}</div></li>`).join('')}</ul>`;
  }

  // ---------------- 改写窗口 ----------------
  function defaultLang() {
    const v = $('#targetLang').value;
    if (v !== 'auto') return v;
    return state.rule ? state.rule.lang.jd : langOf($('#jd').value);
  }

  async function openRewrite(autoStart) {
    $('#rwLang').value = defaultLang();
    openModal('#rewriteModal');
    if (autoStart || !state.rewrite) await runRewrite();
  }

  async function runRewrite() {
    const input = validateInputs();
    if (!input) return;
    if (!aiReady()) { $('#rwBody').innerHTML = '<div class="empty">服务端未配置模型。请在"设置"中填写自带 Key 后重试。</div>'; return; }
    $('#rwRegen').disabled = true;
    $('#rwProgress').hidden = false;
    $('#rwBody').innerHTML = '';
    try {
      if (!state.rule) state.rule = await apiJSON('/api/score', { jd: input.jd, resume: input.resume, role: $('#role').value, meta: state.meta });
      const txt = await apiStream({ task: 'rewrite', jd: input.jd, resume: input.resume, rule: slimRule(state.rule), targetLang: $('#rwLang').value }, (s) => ($('#rwProgressText').textContent = `生成中… 已接收 ${s.length} 字符（逐条 STAR 改写较慢，约 20–60 秒）`));
      state.rewrite = parseLoose(txt);
      renderRewrite(state.rewrite);
    } catch (e) {
      $('#rwBody').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    } finally {
      $('#rwProgress').hidden = true;
      $('#rwRegen').disabled = false;
    }
  }

  function renderRewrite(d) {
    const parts = [];
    if (d.summary?.rewritten) {
      parts.push(`<div class="rw-sec"><div class="rw-sec-h">Summary / 个人简介<button class="btn sm copy" data-copy="summary" type="button">复制</button></div><div style="padding:12px 14px"><div class="txt">${markPh(d.summary.rewritten)}</div>${d.summary.rationale ? `<div class="why">${esc(d.summary.rationale)}</div>` : ''}</div></div>`);
    }
    (d.experiences || []).forEach((sec, si) => {
      parts.push(`<div class="rw-sec"><div class="rw-sec-h">${esc(sec.section)}<button class="btn sm copy" data-copy="sec:${si}" type="button">复制本段</button></div>${(sec.items || []).map((it, ii) => `
        <div class="rw-item">
          <div class="rw-orig">${esc(it.original || '（新增 / 合并）')}</div>
          <div class="rw-new">
            <button class="btn sm copy" data-copy="item:${si}:${ii}" type="button">复制</button>
            <div class="txt">${markPh(it.rewritten)}</div>
            <div class="rw-meta">
              ${it.star ? ['s', 't', 'a', 'r'].filter((k) => it.star[k]).map((k) => `<span class="star"><b>${k.toUpperCase()}</b>${esc(it.star[k])}</span>`).join('') : ''}
            </div>
            <div class="rw-meta">${(it.keywords || []).map((k) => `<span class="kw">${esc(k)}</span>`).join('')}${it.needs_data ? '<span class="lv major">需补充真实数据</span>' : ''}</div>
            ${it.why ? `<div class="why">${esc(it.why)}</div>` : ''}
          </div>
        </div>`).join('')}</div>`);
    });
    if (d.skills_section?.rewritten) {
      parts.push(`<div class="rw-sec"><div class="rw-sec-h">Skills / 专业技能（ATS 友好）<button class="btn sm copy" data-copy="skills" type="button">复制</button></div><div style="padding:12px 14px"><div class="txt" style="white-space:pre-wrap">${markPh(d.skills_section.rewritten)}</div>${d.skills_section.note ? `<div class="why">${esc(d.skills_section.note)}</div>` : ''}</div></div>`);
    }
    if ((d.keywords_not_supported || []).length) {
      parts.push(`<div class="rw-sec"><div class="rw-sec-h">无法如实覆盖的 JD 关键词</div><div style="padding:12px 14px"><div class="chips">${d.keywords_not_supported.map((k) => `<span class="chip miss">${esc(k)}</span>`).join('')}</div><div class="why">如果你确实具备，请补充具体项目证据后再写入；否则不要写，面试中会被追问。</div></div></div>`);
    }
    if ((d.tips || []).length) {
      parts.push(`<div class="rw-sec"><div class="rw-sec-h">投递建议</div><ul class="list" style="padding:12px 14px">${d.tips.map((t) => `<li class="item"><div class="d">${esc(t)}</div></li>`).join('')}</ul></div>`);
    }
    $('#rwBody').innerHTML = parts.join('') || '<div class="empty">未生成内容，请重试。</div>';
  }

  function rewriteText(key) {
    const d = state.rewrite;
    if (!d) return '';
    if (key === 'summary') return d.summary?.rewritten || '';
    if (key === 'skills') return d.skills_section?.rewritten || '';
    const [type, si, ii] = key.split(':');
    const sec = d.experiences?.[+si];
    if (!sec) return '';
    if (type === 'sec') return (sec.items || []).map((i) => '• ' + i.rewritten).join('\n');
    return sec.items?.[+ii]?.rewritten || '';
  }

  function rewriteMarkdown(d) {
    const L = [];
    if (d.summary?.rewritten) L.push('## Summary', d.summary.rewritten, '');
    if (d.experiences?.length) {
      L.push('## Experience');
      d.experiences.forEach((s) => { L.push(`### ${s.section}`); (s.items || []).forEach((i) => L.push(`- ${i.rewritten}`)); L.push(''); });
    }
    if (d.skills_section?.rewritten) L.push('## Skills', d.skills_section.rewritten, '');
    if (d.keywords_not_supported?.length) L.push('## 无法如实覆盖的关键词', d.keywords_not_supported.join(', '), '');
    if (d.tips?.length) L.push('## 建议', ...d.tips.map((t) => `- ${t}`));
    return L.join('\n');
  }

  function applyRewrite() {
    const d = state.rewrite;
    if (!d) return;
    const normKey = (s) => String(s).replace(BULLET, '').replace(/\s+/g, '').toLowerCase();
    const lines = $('#resume').value.split('\n');
    let replaced = 0;
    for (const sec of d.experiences || []) {
      for (const it of sec.items || []) {
        if (!it.original || !it.rewritten) continue;
        const k = normKey(it.original);
        if (k.length < 8) continue;
        const idx = lines.findIndex((l) => { const lk = normKey(l); return lk && (lk === k || (k.length > 20 && lk.includes(k.slice(0, 24)))); });
        if (idx >= 0) {
          const prefix = (lines[idx].match(BULLET) || ['• '])[0];
          lines[idx] = prefix + it.rewritten;
          replaced++;
        }
      }
    }
    if (!replaced) return toast('未能在原简历中定位对应原文，请使用"复制"手动替换', true, 5000);
    $('#resume').value = lines.join('\n');
    updateCounts();
    closeModal($('#rewriteModal'));
    toast(`已替换 ${replaced} 条要点，正在重新评分（占位符 [X%] 请替换为真实数据）`, false, 5000);
    analyze({ allowAutoRewrite: false });
  }

  // ---------------- 互译 ----------------
  function openTranslate(lang, autoRun) {
    const rl = langOf($('#resume').value || '');
    $('#trLang').value = lang || (rl === 'zh' ? 'en' : 'zh');
    openModal('#translateModal');
    if (autoRun) runTranslate();
  }

  async function runTranslate() {
    const rs = $('#resume').value.trim();
    if (rs.length < 30) return toast('请先上传或粘贴简历', true);
    if (!state.code) return showGate();
    if (!aiReady()) return toast('服务端未配置模型，请在"设置"中填写自带 Key', true);
    $('#trRun').disabled = true;
    $('#trProgress').hidden = false;
    $('#trOut').value = '';
    try {
      const txt = await apiStream({ task: 'translate', resume: preparedResume(), targetLang: $('#trLang').value, polish: $('#trPolish').checked }, (s) => {
        $('#trOut').value = s;
        $('#trProgressText').textContent = `翻译中… 已接收 ${s.length} 字符`;
      });
      $('#trOut').value = txt.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
      if ($('#redact').checked) toast('译文中的 [NAME] / [EMAIL] / [PHONE] 等占位符请替换为你的真实信息', false, 5000);
    } catch (e) {
      toast(e.message, true, 5000);
    } finally {
      $('#trRun').disabled = false;
      $('#trProgress').hidden = true;
    }
  }

  // ---------------- 设置 ----------------
  function loadSettingsForm() {
    const b = state.byok || {};
    $('#byokPreset').value = b.preset || '';
    $('#byokKey').value = b.key || '';
    $('#byokBase').value = b.base || '';
    $('#byokModel').value = b.model || '';
  }

  // ---------------- 事件绑定 ----------------
  function updateCounts() {
    $('#jdCount').textContent = `${$('#jd').value.length} 字`;
    $('#resumeCount').textContent = `${$('#resume').value.length} 字`;
  }

  function bind() {
    $('#jd').addEventListener('input', updateCounts);
    $('#resume').addEventListener('input', () => { updateCounts(); state.meta = {}; });

    const dz = $('#dropzone');
    $('#file').addEventListener('change', (e) => { handleFile(e.target.files[0]); e.target.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

    $('#btnPreviewRedact').onclick = () => {
      const r = redact($('#resume').value);
      $('#redactPre').textContent = r.text || '（简历为空）';
      $('#redactStat').textContent = Object.entries(r.stat).filter(([, v]) => v).map(([k, v]) => `${k} ×${v}`).join('  ') || '未检测到敏感信息';
      openModal('#redactModal');
    };

    $('#btnAnalyze').onclick = () => analyze();
    $('#btnRewrite').onclick = () => { if (validateInputs()) openRewrite(!state.rewrite); };
    $('#btnTranslate').onclick = () => openTranslate(null, false);
    $('#btnBannerTranslate').onclick = (e) => openTranslate(e.currentTarget.dataset.lang, true);

    $('#tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      $$('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
      $$('.tabpane').forEach((p) => p.classList.toggle('active', p.dataset.pane === b.dataset.tab));
    });

    $('#rwRegen').onclick = runRewrite;
    $('#rwBody').addEventListener('click', (e) => { const b = e.target.closest('[data-copy]'); if (b) copy(rewriteText(b.dataset.copy)); });
    $('#rwCopyAll').onclick = () => state.rewrite && copy(rewriteMarkdown(state.rewrite));
    $('#rwDownloadMd').onclick = () => state.rewrite && download('resume-tailored.md', rewriteMarkdown(state.rewrite), 'text/markdown');
    $('#rwApply').onclick = applyRewrite;

    $('#trRun').onclick = runTranslate;
    $('#trCopy').onclick = () => copy($('#trOut').value);
    $('#trDownload').onclick = () => download(`resume-${$('#trLang').value}.txt`, $('#trOut').value);
    $('#trApply').onclick = () => {
      const v = $('#trOut').value.trim();
      if (v.length < 30) return toast('译文为空', true);
      $('#resume').value = v;
      state.meta = {};
      updateCounts();
      closeModal($('#translateModal'));
      state.rewrite = null;
      toast('已替换为译文，正在重新评分');
      analyze({ allowAutoRewrite: true });
    };

    $('#btnSettings').onclick = () => { loadSettingsForm(); openModal('#settings'); };
    $('#byokPreset').onchange = (e) => { const p = PRESETS[e.target.value]; if (p) { $('#byokBase').value = p[0]; $('#byokModel').value = p[1]; } };
    $('#byokSave').onclick = () => {
      const key = $('#byokKey').value.trim();
      if (!key) { state.byok = null; localStorage.removeItem('rf_byok'); }
      else {
        state.byok = { preset: $('#byokPreset').value, key, base: $('#byokBase').value.trim() || 'https://api.openai.com/v1', model: $('#byokModel').value.trim() || 'gpt-4o-mini' };
        localStorage.setItem('rf_byok', JSON.stringify(state.byok));
      }
      closeModal($('#settings'));
      toast(state.byok ? '已保存，AI 请求将使用你的 Key' : '已清除自带 Key');
      refreshQuota();
    };
    $('#byokClear').onclick = () => { state.byok = null; localStorage.removeItem('rf_byok'); loadSettingsForm(); toast('已清除'); refreshQuota(); };

    $('#btnLogout').onclick = () => { logout(); showGate(); };

    $('#gateForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = $('#gateCode').value.trim();
      if (!code) return;
      $('#gateBtn').disabled = true;
      $('#gateErr').textContent = '';
      try {
        const d = await verify(code);
        state.code = code;
        localStorage.setItem('rf_code', code);
        renderQuota(d);
        closeModal($('#gate'));
        $('#gateCode').value = '';
        toast(`欢迎，${d.label}`);
      } catch (err) {
        $('#gateErr').textContent = err.message;
      } finally {
        $('#gateBtn').disabled = false;
      }
    });

    $$('.modal').forEach((m) => {
      m.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) closeModal(m);
        else if (e.target === m && m.id !== 'gate') closeModal(m);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      $$('.modal').forEach((m) => { if (!m.hidden && m.id !== 'gate') closeModal(m); });
    });
  }

  async function init() {
    bind();
    updateCounts();
    if (!state.code) return showGate();
    try { renderQuota(await verify(state.code)); }
    catch (e) { logout(); showGate(e.message); }
  }

  init();
})();
