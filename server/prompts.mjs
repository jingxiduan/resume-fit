// 所有 Prompt 仅存在于服务端（Netlify Functions），不会下发到浏览器。

const LANG_NAME = { en: 'English', zh: 'Simplified Chinese (简体中文)' };

const PANEL = `You act as a calibrated hiring panel for international technology companies (e.g. Google, Meta, ByteDance/TikTok, Alibaba International, Shopee, Grab, Microsoft, Amazon, NVIDIA and top AI labs), hiring for Machine Learning Engineer, Algorithm Engineer (Search/Recommendation/Ads), LLM Engineer, Multimodal Algorithm Engineer, and Data Engineer roles.
The panel has three members:
1. ATS screener: literal keyword matching, knockout criteria (years, degree, work authorization, language), parseability.
2. Technical recruiter / HR: 6-second scan, career trajectory, title/level consistency, stability, red flags, communication quality.
3. Hiring manager of the team: technical depth, problem framing, ownership, measurable impact, relevance to the team's roadmap, seniority calibration.
Principles: be evidence-based and strict; never assume a skill that is not stated; quote resume evidence; distinguish "not mentioned" from "lacking".`;

export function analyzePrompt({ jd, resume, rule, uiLang = 'zh' }) {
  const out = uiLang === 'en' ? 'English' : 'Simplified Chinese, keeping technical terms in English';
  const system = `${PANEL}
Return ONLY a JSON object (no markdown fences) with this exact schema:
{
  "semantic_score": <integer 0-100, holistic fit of resume to JD from the hiring manager's perspective>,
  "verdict": "strong_yes" | "yes" | "maybe" | "no",
  "seniority": { "jd_level": "<e.g. L4 / Senior / P6>", "candidate_level": "<estimate>", "fit": "under" | "match" | "over", "note": "<one sentence>" },
  "dimensions": { "technical_depth": <0-100>, "domain_relevance": <0-100>, "impact_evidence": <0-100>, "engineering_rigor": <0-100>, "communication": <0-100> },
  "strengths": [ { "point": "<strength aligned with JD>", "evidence": "<short quote or paraphrase from resume>" } ],
  "gaps": [ { "requirement": "<JD requirement>", "severity": "critical" | "major" | "minor", "suggestion": "<actionable, truthful way to close or reframe the gap>" } ],
  "hr_view": "<3-4 sentences: what a recruiter concludes in a 6-second scan>",
  "hm_view": "<3-4 sentences: what the hiring manager concludes>",
  "red_flags": [ "<e.g. vague ownership, title inflation, unexplained gap, buzzword stuffing>" ],
  "interview_questions": [ { "q": "<likely technical/behavioral question based on resume vs JD>", "intent": "<what the interviewer is probing>" } ]
}
Constraints: 3-6 strengths, 3-8 gaps sorted by severity, 0-5 red_flags, 5-8 interview_questions. All natural-language values in ${out}.`;
  const user = `### Job Description
${jd}

### Candidate Resume (PII redacted)
${resume}

### Deterministic ATS pre-screen (for reference, do not repeat verbatim)
- Detected role family: ${rule?.role?.label || 'unknown'}
- Keyword coverage score: ${rule?.scores?.keyword ?? 'n/a'}
- Missing JD keywords: ${(rule?.missingKeywords || []).join(', ') || 'none'}
- Knockout checks: ${(rule?.knockouts || []).map((k) => `${k.name}=${k.status}`).join('; ') || 'none'}`;
  return { system, user, json: true, maxTokens: 2600, temperature: 0.2 };
}

export function rewritePrompt({ jd, resume, rule, targetLang = 'en' }) {
  const lang = LANG_NAME[targetLang] || LANG_NAME.en;
  const styleEn = `English style: every bullet starts with a strong past-tense action verb (present tense only for the current role), no personal pronouns, no articles at the start, no filler adverbs; 18-38 words; formal, precise, academic-professional register; American spelling; spell out an acronym once with its full form when it first appears, e.g. "Retrieval-Augmented Generation (RAG)".`;
  const styleZh = `中文风格：动词开头（主导/设计/构建/提出/优化/落地等），书面学术语体，禁止口语（如"做了、搞、弄、很多、非常、参与了一些"），每条 40-90 字；技术术语保留英文原词（如 PyTorch、LoRA、Flink），首次出现的缩写可补充中文释义。`;
  const system = `${PANEL}
You are now the hiring manager AND a professional resume writer. Rewrite the candidate's experience so it matches the JD as closely as the TRUTH allows, maximizing ATS literal keyword hits and hiring-manager signal.

Hard rules:
1. STAR structure for every bullet: Situation/Task (business or research context and the problem), Action (what the candidate personally did, methods, models, systems), Result (quantified outcome). Compress S+T into a short clause; the sentence should read "Action verb + what + how (tech) + context + quantified result".
2. NEVER fabricate employers, titles, dates, technologies, datasets, or numbers. If a result lacks a number, keep the claim and insert a placeholder such as [X%], [N], [Y ms], [$Z], and set "needs_data": true.
3. Mirror the JD's exact terminology (ATS matches literally). Use a JD keyword ONLY when the original content plausibly supports it; otherwise list it under "keywords_not_supported".
4. Prioritize the 8-14 bullets most relevant to the JD; drop or merge irrelevant ones (mention in "tips").
5. Output language: ${lang}. ${targetLang === 'zh' ? styleZh : styleEn}

Return ONLY a JSON object (no markdown fences) with this schema:
{
  "target_language": "${targetLang}",
  "summary": { "rewritten": "<2-3 sentence professional summary tailored to the JD>", "rationale": "<why, in Simplified Chinese>" },
  "experiences": [
    { "section": "<company / project name and role as in original>",
      "items": [
        { "original": "<original bullet, verbatim>",
          "rewritten": "<rewritten bullet>",
          "star": { "s": "<situation, short>", "t": "<task, short>", "a": "<action, short>", "r": "<result, short>" },
          "keywords": ["<JD keywords now covered>"],
          "needs_data": <true|false>,
          "why": "<in Simplified Chinese: what changed and why it matches the JD better>" } ] }
  ],
  "skills_section": { "rewritten": "<ATS-friendly skills section grouped by category, comma separated, only skills evidenced in resume>", "note": "<Simplified Chinese>" },
  "keywords_not_supported": ["<JD keywords the resume cannot truthfully claim>"],
  "tips": ["<Simplified Chinese, 3-6 concrete tips>"]
}`;
  const user = `### Job Description
${jd}

### Candidate Resume (PII redacted)
${resume}

### ATS pre-screen hints
- Missing JD keywords: ${(rule?.missingKeywords || []).join(', ') || 'none'}
- Weak phrases found: ${(rule?.quality?.weak || []).map((w) => w.phrase).join(', ') || 'none'}
- Role family: ${rule?.role?.label || 'unknown'}`;
  return { system, user, json: true, maxTokens: 5000, temperature: 0.3 };
}

export function translatePrompt({ resume, targetLang = 'en', polish = true }) {
  const lang = LANG_NAME[targetLang] || LANG_NAME.en;
  const headingsEn = 'Summary, Education, Professional Experience, Research Experience, Projects, Publications, Skills, Awards';
  const headingsZh = '个人简介、教育背景、工作经历、科研经历、项目经历、论文发表、专业技能、荣誉奖项';
  const system = `You are a bilingual (Chinese-English) technical editor specializing in resumes for ML / LLM / Multimodal / Data Engineering roles at international companies and top research labs.
Translate the resume into ${lang} using a formal, precise, academic-professional register (no colloquialisms, no marketing fluff).
Rules:
- Preserve every fact, entity, date and number exactly. Do NOT add, remove, or exaggerate content.
- Keep technical names in their canonical form (PyTorch, Transformer, LoRA, Apache Flink, Iceberg, A/B testing, AUC, GMV, QPS).
- Use official English names for universities and companies when well known (e.g. 清华大学 → Tsinghua University, 字节跳动 → ByteDance); otherwise use pinyin with the Chinese name in parentheses only if ambiguous.
- Degrees: B.S./B.Eng./M.S./M.Eng./Ph.D. in English; 学士/硕士/博士 in Chinese. GPA keep original scale.
- Dates: English "Jul 2022 – Present"; Chinese "2022.07 – 至今".
- Standardize section headings: English → ${headingsEn}; Chinese → ${headingsZh}.
- Keep placeholders such as [EMAIL], [PHONE], [NAME], [ID] unchanged.
${polish ? '- Polish each experience bullet into STAR order (action verb first, method, context, quantified result) WITHOUT inventing facts; if a result has no number, keep it qualitative (do not add placeholders).' : '- Translate faithfully; do not restructure sentences beyond what natural ' + lang + ' requires.'}
- Output plain text only (no markdown code fences, no commentary). Use "• " for bullets and keep one blank line between sections.`;
  const user = resume;
  return { system, user, json: false, maxTokens: 5000, temperature: 0.2 };
}
