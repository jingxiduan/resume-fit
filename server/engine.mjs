import { SKILLS, ROLE_PROFILES, TOP_VENUES, STRONG_VERBS_EN, STRONG_VERBS_ZH, WEAK_PHRASES, SECTION_PATTERNS } from './taxonomy.mjs';

const CJK = /[\u4e00-\u9fff]/;
const CJK_G = /[\u4e00-\u9fff]/g;

function norm(t) {
  return String(t || '')
    .replace(/\r/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\u00a0/g, ' ');
}

function cjkRatio(t) {
  const s = t.replace(/\s/g, '');
  if (!s.length) return 0;
  return (s.match(CJK_G) || []).length / s.length;
}

function textUnits(t) {
  const cjk = (t.match(CJK_G) || []).length;
  const words = (t.replace(CJK_G, ' ').match(/[A-Za-z0-9][A-Za-z0-9+#.\-]*/g) || []).length;
  return cjk / 1.6 + words;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const matcherCache = new Map();
function aliasMatcher(alias) {
  if (matcherCache.has(alias)) return matcherCache.get(alias);
  const a = alias.toLowerCase();
  let fn;
  if (CJK.test(a)) {
    fn = (t) => t.includes(a);
  } else {
    const body = escapeRe(a.replace(/[-_]/g, ' ')).replace(/\s+/g, '[\\s\\-_]*');
    const re = new RegExp(`(^|[^a-z0-9+#])${body}(?:s|es|ing|ed)?(?![a-z0-9+#])`, 'i');
    fn = (t) => re.test(t);
  }
  matcherCache.set(alias, fn);
  return fn;
}

function skillHit(skill, lowerText) {
  return skill.aliases.some((a) => aliasMatcher(a)(lowerText));
}

// ---------------- 简历结构解析 ----------------
function detectHeading(line) {
  const clean = line.replace(/^[\s#*•·▪●◦►▶■□\-–|:：\d.、]+/, '').replace(/[\s:：|]+$/, '').trim();
  if (!clean || clean.length > 40) return null;
  for (const [name, re] of Object.entries(SECTION_PATTERNS)) {
    if (re.test(clean)) {
      // 防止把正文句子误识别为标题：英文标题一般 <= 5 个词
      if (!CJK.test(clean) && clean.split(/\s+/).length > 5) continue;
      return name;
    }
  }
  return null;
}

function splitSections(text) {
  const lines = text.split('\n');
  const sections = { header: [] };
  const found = [];
  let cur = 'header';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const h = detectHeading(line);
    if (h) {
      cur = h;
      if (!found.includes(h)) found.push(h);
      sections[cur] = sections[cur] || [];
      continue;
    }
    const arr = (sections[cur] = sections[cur] || []);
    const prev = arr[arr.length - 1];
    // PDF 自动换行导致的断句：小写字母 / 连接符开头且上一行未以句末标点结束时并入上一行
    if (prev && /^[a-z(&%\d]/.test(line) && !BULLET_PREFIX.test(raw.trimStart().slice(0, 2)) && !/[.。;；:：!?！？]$/.test(prev)) {
      arr[arr.length - 1] = prev + ' ' + line;
      continue;
    }
    arr.push(line);
  }
  return { sections, found };
}

const BULLET_PREFIX = /^[\s•·▪●◦►▶■□✓✔➢\-–*+]+|^\(?\d{1,2}[).、]\s*/;

function extractBullets(sections) {
  let pool = [...(sections.experience || []), ...(sections.projects || [])];
  if (pool.length < 3) pool = Object.entries(sections).filter(([k]) => !['education', 'skills', 'header'].includes(k)).flatMap(([, v]) => v);
  return pool
    .map((l) => l.replace(BULLET_PREFIX, '').trim())
    .filter((l) => {
      const units = textUnits(l);
      if (units < 7) return false;
      // 纯日期/职位行
      if (DATE_RANGE_RE.test(l) && units < 14) return false;
      return true;
    });
}

// ---------------- 日期与工作年限 ----------------
const MON_MAP = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const DATE_TOKEN = '(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?\\s*\\d{4}|\\d{4}\\s*(?:[./\\-]|年)\\s*\\d{1,2}\\s*月?|\\d{4})';
const END_TOKEN = `(?:${DATE_TOKEN}|present|now|current|today|至今|今|现在)`;
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|~|～|to|至)\\s*(${END_TOKEN})`, 'i');
const DATE_RANGE_G = new RegExp(DATE_RANGE_RE.source, 'gi');

function parseDateToken(s, isEnd) {
  s = s.toLowerCase().trim();
  if (/present|now|current|today|至今|今|现在/.test(s)) {
    const d = new Date();
    return d.getFullYear() * 12 + d.getMonth();
  }
  let m = s.match(/^([a-z]+)\.?\s*(\d{4})/);
  if (m) return parseInt(m[2], 10) * 12 + ((MON_MAP[m[1].slice(0, 4)] || MON_MAP[m[1].slice(0, 3)] || 1) - 1);
  m = s.match(/^(\d{4})\s*(?:[./\-]|年)\s*(\d{1,2})/);
  if (m) return parseInt(m[1], 10) * 12 + Math.min(11, Math.max(0, parseInt(m[2], 10) - 1));
  m = s.match(/^(\d{4})/);
  if (m) return parseInt(m[1], 10) * 12 + (isEnd ? 11 : 0);
  return null;
}

function computeExperienceYears(sections) {
  const lines = sections.experience && sections.experience.length ? sections.experience : [];
  const intervals = [];
  for (const l of lines) {
    for (const m of l.matchAll(DATE_RANGE_G)) {
      const a = parseDateToken(m[1], false);
      const b = parseDateToken(m[2], true);
      if (a && b && b >= a && b - a < 12 * 40) intervals.push([a, b + 1]);
    }
  }
  if (!intervals.length) return null;
  intervals.sort((x, y) => x[0] - y[0]);
  let total = 0;
  let [s, e] = intervals[0];
  for (const [a, b] of intervals.slice(1)) {
    if (a <= e) e = Math.max(e, b);
    else { total += e - s; s = a; e = b; }
  }
  total += e - s;
  return Math.round((total / 12) * 10) / 10;
}

function detectDateFormats(text) {
  const fmts = new Set();
  if (/\b\d{4}\.\d{1,2}\b/.test(text)) fmts.add('YYYY.MM');
  if (/\b\d{4}\/\d{1,2}\b/.test(text)) fmts.add('YYYY/MM');
  if (/\b\d{4}-\d{1,2}\b(?!\s*\d)/.test(text)) fmts.add('YYYY-MM');
  if (/\d{4}年\s*\d{1,2}月/.test(text)) fmts.add('YYYY年MM月');
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}/i.test(text)) fmts.add('Mon YYYY');
  return [...fmts];
}

// ---------------- JD 解析 ----------------
const NICE_HEAD = /(preferred|nice[- ]to[- ]have|bonus|plus|desired|good to have|preferable|加分|优先|更佳|最好)/i;
const MUST_HEAD = /(requirements?|qualifications?|must[- ]have|what you('|’)ll need|what we('|’)re looking for|who you are|minimum|basic qualifications|任职要求|岗位要求|职位要求|任职资格|我们希望你)/i;
const RESP_HEAD = /(responsibilities|what you('|’)ll do|the role|key duties|job description|岗位职责|工作职责|职位描述|工作内容)/i;

function parseJD(jdText) {
  const lines = jdText.split('\n').map((l) => l.trim()).filter(Boolean);
  let mode = 'resp';
  const tagged = [];
  for (const line of lines) {
    const short = line.length < 60;
    if (short && NICE_HEAD.test(line) && !/required/i.test(line)) { mode = 'nice'; }
    else if (short && MUST_HEAD.test(line)) { mode = 'must'; }
    else if (short && RESP_HEAD.test(line)) { mode = 'resp'; }
    const lineMode = NICE_HEAD.test(line) && mode !== 'nice' && !short ? 'nice' : mode;
    tagged.push({ line, mode: lineMode });
  }
  return tagged;
}

const DEGREE_RE = {
  3: /\b(ph\.?\s?d|doctorate|doctoral)\b|博士/i,
  2: /\b(master'?s?|m\.s\.|msc|m\.sc|m\.eng|mphil)\b|\bms(?=\s*(\/|or|in|degree|,|\)))|硕士|研究生/i,
  1: /\b(bachelor'?s?|b\.s\.|bsc|b\.sc|b\.eng|undergraduate)\b|\bbs(?=\s*(\/|or|in|degree|,|\)))|本科|学士/i
};

function degreeIn(text) {
  for (const lvl of [3, 2, 1]) if (DEGREE_RE[lvl].test(text)) return lvl;
  return 0;
}
const DEGREE_NAME = { 0: '未识别', 1: '本科 / Bachelor', 2: '硕士 / Master', 3: '博士 / PhD' };

function jdRequirements(tagged) {
  const mustText = tagged.filter((t) => t.mode !== 'nice').map((t) => t.line).join('\n');
  const all = tagged.map((t) => t.line).join('\n');
  const req = {};

  const years = [];
  for (const m of mustText.matchAll(/(\d{1,2})\s*\+?\s*(?:-|~|to)?\s*(?:\d{1,2})?\s*\+?\s*(?:years?|yrs?)/gi)) years.push(parseInt(m[1], 10));
  for (const m of mustText.matchAll(/(\d{1,2})\s*(?:-|~|至)?\s*(?:\d{1,2})?\s*年(?:以上|及以上|或以上)?(?:[^\n]{0,8})(?:经验|工作)/g)) years.push(parseInt(m[1], 10));
  const ys = years.filter((y) => y > 0 && y <= 15);
  if (ys.length) req.years = Math.max(...ys);

  const degreeLines = tagged.filter((t) => t.mode !== 'nice' && /(degree|ph\.?d|master|bachelor|\bms\b|\bbs\b|学历|本科|硕士|博士)/i.test(t.line));
  if (degreeLines.length) {
    const lvls = [];
    for (const d of degreeLines) {
      for (const lvl of [1, 2, 3]) if (DEGREE_RE[lvl].test(d.line)) lvls.push(lvl);
    }
    if (lvls.length) req.degree = Math.min(...lvls);
  }

  if (/(fluent|proficien|excellent|strong|professional)[^.\n]{0,40}english|english[^.\n]{0,25}(fluen|proficien|communication|speaking|writing)|英语|英文(?!名)/i.test(all)) req.english = true;
  if (/(mandarin|chinese)[^.\n]{0,20}(fluen|proficien|native|speaking)|(fluen|proficien|native)[^.\n]{0,20}(mandarin|chinese)/i.test(all)) req.mandarin = true;
  if (/(publication|published|first[- ]author|top[- ]tier (conference|venue|journal)|papers? (at|in) |neurips|icml|iclr|cvpr|iccv|eccv|\bacl\b|emnlp|\bkdd\b|sigir|论文|顶会|发表)/i.test(all)) {
    req.publications = tagged.some((t) => t.mode !== 'nice' && /(publication|first[- ]author|top[- ]tier|论文|顶会|发表)/i.test(t.line)) ? 'must' : 'nice';
  }
  if (/(work authori[sz]ation|authori[sz]ed to work|visa|sponsorship|right to work|citizenship|security clearance)/i.test(all)) req.workAuth = true;
  if (/(relocat|on[- ]?site|hybrid|in[- ]office)/i.test(all)) req.location = true;
  return req;
}

const ACRONYM_STOP = new Set(['AND', 'THE', 'FOR', 'YOU', 'OUR', 'WE', 'US', 'USA', 'UK', 'EU', 'HR', 'EEO', 'EOE', 'CEO', 'CTO', 'VP', 'PM', 'OR', 'TO', 'IN', 'OF', 'AN', 'AS', 'AT', 'BY', 'IS', 'IT', 'ON', 'BE', 'ALL', 'NEW', 'API', 'AI', 'ML', 'JD', 'PHD', 'MS', 'BS', 'BA', 'MBA', 'GPA', 'FAQ', 'ETC', 'IE', 'EG', 'OK', 'Q1', 'Q2', 'Q3', 'Q4', 'KPI', 'OKR', 'SDE', 'SWE', 'MLE', 'LGBTQ', 'PTO', 'RSU', 'APAC', 'EMEA', 'NA', 'CN', 'SG', 'HK', 'JP', 'KR', 'TBD', 'N/A']);

function extraKeywords(jdText, matchedLabelsLower) {
  const out = new Map();
  const tokens = jdText.match(/\b(?:[A-Z]{2,7}[0-9]?|[A-Z][a-z]+[A-Z][A-Za-z0-9]*|[A-Za-z]+[0-9]+[A-Za-z0-9]*)\b/g) || [];
  for (const tok of tokens) {
    if (ACRONYM_STOP.has(tok.toUpperCase())) continue;
    if (/^\d/.test(tok)) continue;
    const low = tok.toLowerCase();
    if (matchedLabelsLower.some((l) => l.includes(low))) continue;
    if (SKILLS.some((s) => s.aliases.some((a) => a === low))) continue;
    if (TOP_VENUES.includes(low)) continue;
    out.set(tok, (out.get(tok) || 0) + 1);
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);
}

// ---------------- 角色识别 ----------------
function detectRole(jdLower) {
  const catHits = {};
  for (const s of SKILLS) if (skillHit(s, jdLower)) catHits[s.cat] = (catHits[s.cat] || 0) + 1;
  let best = 'ml';
  let bestScore = -1;
  for (const [role, prof] of Object.entries(ROLE_PROFILES)) {
    let sc = 0;
    for (const [cat, w] of Object.entries(prof.cats)) sc += (catHits[cat] || 0) * w;
    if (/data engineer|数据工程|数仓|数据开发/i.test(jdLower) && role === 'de') sc += 12;
    if (/(llm|large language|大模型|大语言)/i.test(jdLower) && role === 'llm') sc += 6;
    if (/(multimodal|多模态|vision-language|vlm)/i.test(jdLower) && role === 'mm') sc += 8;
    if (/(recommend|ranking|ads|advertis|推荐|搜索|广告)/i.test(jdLower) && role === 'algo') sc += 5;
    if (sc > bestScore) { best = role; bestScore = sc; }
  }
  return best;
}

// ---------------- 表述质量（STAR） ----------------
const METRIC_RE = /(\d+(?:\.\d+)?\s*(%|％|x\b|×|倍|k\b|m\b|b\b|ms\b|qps|tps|pp\b|bp\b|bps\b|gb|tb|pb|万|亿|千|百万|小时|天|周|人|个|篇|项|篇|ms|毫秒|秒)|[$¥€£]\s?\d|top[- ]?\d|\d+(\.\d+)?\s*(points?|million|billion|thousand|users|samples|tokens|params|parameters|gpus))/i;
const RESULT_RE = /(result(ing|ed) in|leading to|achiev|improv|increas|reduc|boost|cut|sav|accelerat|outperform|enabl|deliver|yield|surpass|提升|提高|降低|减少|缩短|节省|增长|带来|实现了?|达到|超过|优于|使得|助力|支撑)/i;
const CONTEXT_RE = /(to (address|solve|tackle|support|enable|improve|reduce)|in order to|for (the|a|our)?\s*\w+|across|serving|handling|given|under|面向|针对|为解决|为了|基于|在.{1,12}场景|服务于|支持|承载)/i;

function leadingVerbStrong(line) {
  const l = line.trim();
  if (CJK.test(l.slice(0, 6))) return STRONG_VERBS_ZH.some((v) => l.startsWith(v) || l.slice(0, 8).includes(v));
  const first = (l.match(/^[A-Za-z\-]+/) || [''])[0].toLowerCase();
  return STRONG_VERBS_EN.includes(first) || /ed$/.test(first) && first.length > 4;
}

function analyzeQuality(bullets, fullText) {
  let quant = 0, strong = 0, starSum = 0;
  const unquantified = [];
  const weakHits = [];
  const longBullets = [];
  for (const b of bullets) {
    const hasMetric = METRIC_RE.test(b);
    const verb = leadingVerbStrong(b);
    const result = RESULT_RE.test(b) || hasMetric;
    const context = CONTEXT_RE.test(b);
    if (hasMetric) quant++; else unquantified.push(b);
    if (verb) strong++;
    starSum = starSum + ((context ? 1 : 0) + (verb ? 1 : 0) + (result ? 1 : 0) + (hasMetric ? 1 : 0)) / 4;
    const isZh = cjkRatio(b) > 0.3;
    if ((isZh && b.length > 130) || (!isZh && b.split(/\s+/).length > 45)) longBullets.push(b);
  }
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const wp of WEAK_PHRASES) {
    const line = lines.find((l) => wp.re.test(l));
    if (line) weakHits.push({ phrase: wp.phrase, line: line.length > 140 ? line.slice(0, 140) + '…' : line, fix: wp.fix });
  }
  const n = bullets.length || 1;
  return {
    bullets: bullets.length,
    quantified: quant,
    strongVerb: strong,
    quantRatio: quant / n,
    verbRatio: strong / n,
    starAvg: starSum / n,
    weak: weakHits,
    unquantified: unquantified.slice(0, 8),
    longBullets: longBullets.slice(0, 5)
  };
}

// ---------------- ATS 可解析性 ----------------
function analyzeATS(resume, sections, found, jdLang, resumeLang, meta) {
  const issues = [];
  const len = resume.replace(/\s/g, '').length;
  const add = (level, title, detail, fix) => issues.push({ level, title, detail, fix });

  if (len < 300) add('critical', '可提取文本过少', `仅解析出约 ${len} 个字符，ATS 很可能把整份简历当作图片处理。`, '使用可复制文字的 PDF 或 DOCX 导出（Word / Google Docs / LaTeX），不要使用扫描件或整页图片。');
  if (meta && meta.pages && len / meta.pages < 400 && len >= 300) add('major', '部分页面文字稀少', '可能存在嵌入图片的文字（如技能图标、进度条）。', '技能熟练度用文字表述，删除进度条 / 星级 / 图标。');

  const hasEmail = /\[EMAIL\]|[\w.+-]+@[\w-]+\.[\w.]+/.test(resume);
  const hasPhone = /\[PHONE\]|\+?\d[\d\s\-()]{8,}\d/.test(resume);
  if (!hasEmail) add('critical', '未识别到邮箱', 'ATS 与 HR 均以邮箱作为候选人唯一联系方式。', '在简历顶部正文（不要放在页眉页脚或文本框）写明邮箱。');
  if (!hasPhone) add('major', '未识别到电话', '国际岗位建议写带国家码的电话，例如 +86 / +1 / +65。', '在顶部联系信息中加入带国家码的电话。');
  if (!/linkedin\.com/i.test(resume)) add('minor', '缺少 LinkedIn', '海外 HR 习惯交叉核验 LinkedIn。', '添加 linkedin.com/in/your-id，并保持与简历信息一致。');
  if (!/github\.com|huggingface\.co|scholar\.google|kaggle\.com/i.test(resume)) add('minor', '缺少技术主页', '算法 / 数据岗位常看 GitHub、Google Scholar、Hugging Face 或 Kaggle。', '附上一个能体现代码或论文的链接。');

  const need = ['education', 'experience', 'skills'];
  const missing = need.filter((s) => !found.includes(s));
  if (missing.length) {
    const names = { education: 'Education / 教育背景', experience: 'Experience / 工作经历', skills: 'Skills / 专业技能' };
    add('major', '缺少标准段落标题', `未识别到：${missing.map((m) => names[m]).join('、')}。ATS 依赖标准标题切分字段。`, '使用标准标题：Education、Professional Experience、Projects、Publications、Skills（中文：教育背景、工作经历、项目经历、论文发表、专业技能）。');
  }

  const icon = (resume.match(/[\uE000-\uF8FF\u2600-\u27BF\u{1F300}-\u{1FAFF}]/gu) || []).length;
  if (icon > 3) add('major', '包含图标 / 特殊符号', `检测到 ${icon} 个图标字符（如 ☎ ✉ ★ 或 icon font），ATS 会解析为乱码。`, '用纯文本 "Email: / Phone:" 替代图标。');

  const multiCol = resume.split('\n').filter((l) => /\S\s{4,}\S/.test(l)).length;
  if (multiCol > 6) add('major', '疑似双栏 / 表格排版', `有 ${multiCol} 行存在大段空白分隔，ATS 可能按行横向拼接两栏内容导致语义错乱。`, '改为单栏自上而下的版式；不要使用表格、文本框与侧边栏。');

  const fmts = detectDateFormats(resume);
  if (fmts.length > 1) add('minor', '日期格式不统一', `同时出现：${fmts.join('、')}。`, '统一为一种格式，英文推荐 "Jul 2022 – Present"，中文推荐 "2022.07 – 至今"。');

  if (jdLang === 'en' && resumeLang === 'zh') add('critical', '简历语言与 JD 不一致', 'JD 为英文而简历为中文。海外 ATS 按字面关键词匹配，中文简历的关键词命中率接近 0。', '使用下方"学术化中英互译"生成英文版本后再投递。');
  if (jdLang === 'zh' && resumeLang === 'en') add('minor', 'JD 为中文、简历为英文', '国内团队 HR 初筛时阅读成本更高。', '可准备中英双版本，或使用中文版本投递。');

  const units = textUnits(resume);
  if (units > 1100) add('minor', '篇幅偏长', `约 ${Math.round(units)} 个词，超过 2 页。`, '工业界简历 1–2 页为宜；保留与 JD 最相关的经历。');
  if (units < 220 && len >= 300) add('major', '内容偏少', '信息密度不足，难以支撑关键词覆盖与能力判断。', '每段经历补充 3–5 条 STAR 结构的要点。');

  if (/(照片|photo|出生|birth|date of birth|籍贯|婚姻|marital|政治面貌|身高|体重|gender|性别)/i.test(resume) && jdLang === 'en') add('major', '包含海外不建议出现的个人信息', '北美 / 欧洲出于反歧视合规，部分公司会直接过滤含照片、年龄、婚姻、性别信息的简历。', '国际岗位删除照片、出生日期、婚姻、性别、籍贯等信息。');

  let score = 100;
  for (const i of issues) score -= i.level === 'critical' ? 35 : i.level === 'major' ? 14 : 5;
  return { issues, score: Math.max(0, score) };
}

// ---------------- 加分信号 ----------------
function analyzeSignals(resumeLower, role) {
  const venues = TOP_VENUES.filter((v) => aliasMatcher(v)(resumeLower));
  const sig = [
    { name: '顶会 / 顶刊论文', found: venues.length > 0, detail: venues.length ? venues.map((v) => v.toUpperCase()).join(', ') : '' , w: role === 'de' ? 0.5 : 2 },
    { name: '开源贡献 / GitHub', found: /github\.com|open[- ]source|开源|contributor|stars?\b/i.test(resumeLower), w: 1.5 },
    { name: '竞赛奖项（Kaggle / ACM / 天池等）', found: /kaggle|acm|icpc|天池|kdd cup|竞赛|competition|medal|金牌|银牌/i.test(resumeLower), w: 1 },
    { name: '专利', found: /patent|专利/i.test(resumeLower), w: 0.5 },
    { name: '线上业务落地', found: /(production|online|deployed|serving|上线|落地|线上|全量)/i.test(resumeLower), w: 1.5 },
    { name: '大规模数据 / 算力', found: /(billion|million|tb\b|pb\b|亿|万级|千万|gpu|a100|h100|h800|多机多卡|分布式)/i.test(resumeLower), w: 1 },
    { name: '跨团队 / 国际协作', found: /(cross[- ]functional|stakeholder|global team|overseas|跨团队|跨部门|海外|出海|国际化)/i.test(resumeLower), w: 0.8 }
  ];
  const total = sig.reduce((a, s) => a + s.w, 0);
  const got = sig.filter((s) => s.found).reduce((a, s) => a + s.w, 0);
  return { list: sig.map(({ w, ...r }) => r), score: Math.min(100, Math.round((got / total) * 100 * 1.25)) };
}

// ---------------- 主流程 ----------------
export function scoreResume({ jd, resume, role = 'auto', meta = {} }) {
  jd = norm(jd).slice(0, 20000);
  resume = norm(resume).slice(0, 30000);
  const jdLower = jd.toLowerCase();
  const resumeLower = resume.toLowerCase();
  const jdLang = cjkRatio(jd) > 0.15 ? 'zh' : 'en';
  const resumeLang = cjkRatio(resume) > 0.15 ? 'zh' : 'en';
  const detectedRole = role && role !== 'auto' && ROLE_PROFILES[role] ? role : detectRole(jdLower);

  // 关键词
  const tagged = parseJD(jd);
  const kwMap = new Map();
  const W = { must: 3, resp: 2, nice: 1 };
  for (const t of tagged) {
    const ll = t.line.toLowerCase();
    for (const s of SKILLS) {
      if (!skillHit(s, ll)) continue;
      const prev = kwMap.get(s.label);
      if (!prev || W[t.mode] > W[prev.mode]) kwMap.set(s.label, { skill: s, mode: t.mode });
    }
  }
  const keywords = { must: [], nice: [], extra: [] };
  let wTotal = 0, wGot = 0, mustTotal = 0, mustGot = 0;
  for (const [label, { skill, mode }] of kwMap) {
    const matched = skillHit(skill, resumeLower);
    const literal = matched ? skill.aliases.some((a) => !CJK.test(a) && aliasMatcher(a)(resumeLower)) : false;
    const item = { label, cat: skill.cat, matched, literal, mode };
    (mode === 'nice' ? keywords.nice : keywords.must).push(item);
    wTotal += W[mode];
    if (matched) wGot += W[mode];
    if (mode !== 'nice') { mustTotal++; if (matched) mustGot++; }
  }
  const extras = extraKeywords(jd, [...kwMap.keys()].map((k) => k.toLowerCase()));
  for (const e of extras) {
    const matched = aliasMatcher(e.toLowerCase())(resumeLower);
    keywords.extra.push({ label: e, matched, mode: 'extra' });
    wTotal += 0.5;
    if (matched) wGot += 0.5;
  }
  keywords.must.sort((a, b) => Number(a.matched) - Number(b.matched));
  keywords.nice.sort((a, b) => Number(a.matched) - Number(b.matched));
  const keywordScore = wTotal ? Math.round((wGot / wTotal) * 100) : null;
  const mustCoverage = mustTotal ? mustGot / mustTotal : null;

  // 结构
  const { sections, found } = splitSections(resume);
  const bullets = extractBullets(sections);

  // 硬性门槛
  const req = jdRequirements(tagged);
  const knockouts = [];
  const kScores = [];
  const years = computeExperienceYears(sections);
  if (req.years) {
    let status = 'unknown', s = 0.6;
    if (years != null) {
      if (years >= req.years) { status = 'pass'; s = 1; }
      else if (years >= req.years * 0.7) { status = 'warn'; s = 0.65; }
      else { status = 'fail'; s = 0.25; }
    }
    knockouts.push({ name: '工作年限', required: `${req.years}+ 年`, candidate: years != null ? `约 ${years} 年（按 Experience 段日期合并计算）` : '未识别到工作经历日期', status, note: status === 'unknown' ? '请在每段经历写明起止年月，ATS 会据此自动计算年限。' : status === 'pass' ? '' : '年限不足时，用项目深度、论文或业务规模弥补，并在 Summary 中突出相关年限。' });
    kScores.push(s);
  }
  const candDegree = degreeIn((sections.education || []).join('\n') || resume);
  if (req.degree) {
    const ok = candDegree >= req.degree;
    knockouts.push({ name: '学历', required: DEGREE_NAME[req.degree] + ' 及以上', candidate: DEGREE_NAME[candDegree], status: candDegree === 0 ? 'unknown' : ok ? 'pass' : 'fail', note: candDegree === 0 ? '教育背景请写全学位名称，如 "M.S. in Computer Science"。' : '' });
    kScores.push(candDegree === 0 ? 0.6 : ok ? 1 : 0.3);
  }
  if (req.english) {
    const ev = resumeLang === 'en' || /(ielts|toefl|cet-?6|cet-?4|gre|gmat|雅思|托福|英语六级|英语四级|fluent english|english \((fluent|professional|native)|full professional|professional working proficiency|英语流利)/i.test(resume);
    knockouts.push({ name: '英语能力', required: '工作语言 / 流利沟通', candidate: ev ? '有证据（英文简历或语言成绩）' : '未体现', status: ev ? 'pass' : 'warn', note: ev ? '' : '在 Skills 中写明 "English (Professional Working Proficiency, IELTS 7.0)" 等可验证信息。' });
    kScores.push(ev ? 1 : 0.5);
  }
  if (req.publications) {
    const venues = TOP_VENUES.filter((v) => aliasMatcher(v)(resumeLower));
    const has = venues.length > 0 || found.includes('publications');
    knockouts.push({ name: '论文发表', required: req.publications === 'must' ? '要求' : '加分项', candidate: has ? (venues.length ? venues.map((v) => v.toUpperCase()).join(', ') : '有 Publications 段落') : '未体现', status: has ? 'pass' : req.publications === 'must' ? 'fail' : 'warn', note: has ? '' : '如有 arXiv / Workshop / 在投论文也应列出，并注明作者排序。' });
    kScores.push(has ? 1 : req.publications === 'must' ? 0.3 : 0.7);
  }
  const knockoutScore = kScores.length ? Math.round((kScores.reduce((a, b) => a + b, 0) / kScores.length) * 100) : 100;

  // 质量 / ATS / 信号
  const quality = analyzeQuality(bullets, resume);
  const weakPenalty = Math.min(1, quality.weak.length / 6);
  const qualityScore = bullets.length
    ? Math.round((0.35 * quality.quantRatio + 0.3 * quality.starAvg + 0.2 * quality.verbRatio + 0.15 * (1 - weakPenalty)) * 100)
    : 30;
  const ats = analyzeATS(resume, sections, found, jdLang, resumeLang, meta);
  const signals = analyzeSignals(resumeLower, detectedRole);

  // 综合
  const parts = [
    { k: 'keyword', v: keywordScore, w: 0.4 },
    { k: 'knockout', v: knockoutScore, w: 0.15 },
    { k: 'quality', v: qualityScore, w: 0.2 },
    { k: 'ats', v: ats.score, w: 0.15 },
    { k: 'signals', v: signals.score, w: 0.1 }
  ].filter((p) => p.v != null);
  const wsum = parts.reduce((a, p) => a + p.w, 0);
  let overall = Math.round(parts.reduce((a, p) => a + p.v * p.w, 0) / wsum);
  const criticalATS = ats.issues.some((i) => i.level === 'critical');
  const failedKO = knockouts.some((k) => k.status === 'fail');
  if (criticalATS) overall = Math.min(overall, 59);

  let passLevel = 'low';
  if (!criticalATS && !failedKO && (mustCoverage == null || mustCoverage >= 0.7) && overall >= 75) passLevel = 'high';
  else if (!criticalATS && (mustCoverage == null || mustCoverage >= 0.5) && overall >= 60) passLevel = 'medium';

  const reasons = [];
  if (criticalATS) reasons.push('存在 ATS 致命问题（解析失败或语言不一致）');
  if (failedKO) reasons.push('有硬性门槛未满足，可能被投递表单的 knockout 问题直接过滤');
  if (mustCoverage != null && mustCoverage < 0.7) reasons.push(`必备关键词覆盖率 ${Math.round(mustCoverage * 100)}%（ATS 常见阈值约 70%–80%）`);
  if (!reasons.length) reasons.push('关键词覆盖与结构均达到常见 ATS 阈值');

  // 投递表单常见硬性问题
  const formQuestions = [];
  if (req.workAuth) formQuestions.push('是否具备当地合法工作身份 / 是否需要签证担保（Visa Sponsorship）—— 如实填写，这是最常见的自动淘汰项。');
  if (req.years) formQuestions.push(`"您是否有 ${req.years} 年以上相关经验？" —— 简历中的日期需能支撑你的回答。`);
  if (req.degree) formQuestions.push(`"最高学历是否为 ${DEGREE_NAME[req.degree]} 及以上？"`);
  if (req.location) formQuestions.push('是否接受 On-site / Hybrid / Relocation —— 不接受时多数系统直接过滤。');
  if (req.english) formQuestions.push('英语水平自评 —— 与简历中的语言证明保持一致。');
  formQuestions.push('期望薪资（Expected Salary）—— 填写区间并参考 levels.fyi / Glassdoor，超出 HC 预算可能被自动排序靠后。');

  // 优先级建议
  const suggestions = [];
  const missingMust = keywords.must.filter((k) => !k.matched).map((k) => k.label);
  if (criticalATS) suggestions.push({ p: 'P0', text: '先修复 ATS 致命问题，否则后续优化无效。' });
  if (missingMust.length) suggestions.push({ p: 'P0', text: `补齐必备关键词（仅限真实具备的）：${missingMust.slice(0, 8).join('、')}。放在 Skills 段，并至少在一条经历中以 STAR 方式体现。` });
  const nonLiteral = keywords.must.filter((k) => k.matched && !k.literal && jdLang === 'en').map((k) => k.label);
  if (nonLiteral.length) suggestions.push({ p: 'P1', text: `以下技能仅以中文出现，英文 ATS 无法命中，需写出英文原词：${nonLiteral.slice(0, 8).join('、')}。` });
  if (quality.quantRatio < 0.5 && bullets.length) suggestions.push({ p: 'P1', text: `仅 ${Math.round(quality.quantRatio * 100)}% 的要点含量化结果。建议每条补充指标（AUC/GMV/延迟/成本/吞吐/准确率的提升幅度）。` });
  if (quality.weak.length) suggestions.push({ p: 'P1', text: `存在 ${quality.weak.length} 类口语化 / 弱表述，见"STAR 表述"标签页。` });
  if (knockouts.some((k) => k.status !== 'pass')) suggestions.push({ p: 'P1', text: '核对"硬性门槛"中未通过 / 未识别的项目，确保信息可被机器读取。' });
  if (ats.issues.some((i) => i.level === 'major')) suggestions.push({ p: 'P2', text: '处理 ATS 主要问题（版式、标题、图标），提升解析准确率。' });

  return {
    role: { id: detectedRole, label: ROLE_PROFILES[detectedRole].label },
    lang: { jd: jdLang, resume: resumeLang },
    scores: { overall, keyword: keywordScore, knockout: knockoutScore, quality: qualityScore, ats: ats.score, signals: signals.score },
    pass: { level: passLevel, reasons },
    keywords,
    mustCoverage,
    knockouts,
    ats: ats.issues,
    quality,
    sectionsFound: found,
    signals: signals.list,
    formQuestions,
    suggestions,
    missingKeywords: [...missingMust, ...keywords.nice.filter((k) => !k.matched).map((k) => k.label), ...keywords.extra.filter((k) => !k.matched).map((k) => k.label)].slice(0, 20),
    bulletsSample: bullets.slice(0, 40)
  };
}
