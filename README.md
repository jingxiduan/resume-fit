# ResumeFit

A self-check tool for matching a resume against a job description. Built for ML, search and recommendation, LLM, multimodal, and data engineering roles.

It scores a resume the way an applicant tracking system, a recruiter, and a hiring manager would read it. When the score falls short, it rewrites weak bullets into STAR format and translates between Chinese and English.

## Features

- Rule engine. Runs offline, no network call, instant result. Keyword coverage split into required and nice-to-have. Hard requirement checks for years of experience, degree, English level, and publications, all pulled from the job description. Parsing checks for scanned PDFs, multi-column layouts, icon bullets, inconsistent dates, and missing contact info. STAR quality checks for quantified results, strong verbs, and vague phrasing, with suggested fixes. Bonus signal detection for top-tier publications, open source work, competition awards, and shipped products.
- Semantic evaluation. Needs a configured model. Simulates a six-second recruiter screen and a hiring manager's technical read. Outputs a verdict, a seniority match, a skill radar, strengths, gaps, risk flags, and likely interview questions.
- STAR rewrite. Needs a configured model. Shows original and rewritten text side by side for each bullet, tagged with S, T, A, R, and matched keywords. Never invents experience. Missing numbers get a placeholder such as `[X%]`. Keywords the resume cannot honestly support are listed on their own, not forced into the text.
- Translation. Needs a configured model. Chinese to English and back, in an academic resume register. Technical terms stay in English.
- Application form prediction. Guesses the knockout questions a job portal is likely to ask: work authorization, years of experience, degree, English level, location.

## Project layout

```
server/             scoring engine, prompts, auth, quota — no frontend code
netlify/functions/  Netlify Functions: /api/verify /api/score /api/llm
src/                 frontend source, build input
scripts/build.mjs    copies src to dist, vendors PDF.js and Mammoth, obfuscates app.js
scripts/dev.mjs      local dev server, no Netlify CLI needed
```

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:8888`.

## Deploy to Netlify

1. Run `npm run build` and check the output in `dist`.
2. Create a Netlify site from this repository, or run `netlify deploy`. Build command is `npm run build`, publish directory is `dist`, functions directory is `netlify/functions`. These are already set in `netlify.toml`.
3. Set these under Site configuration, Environment variables. Do not commit them to the repository.
   - `ACCESS_CODES`: format is `name:code`, comma separated. Leave empty and the site runs open, no code needed. Set it and each person gets a separate code, so one leak does not affect the rest.
   - `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`: credentials for the model provider. Leave empty and only rule scoring runs. Visitors can still paste their own key under Settings.
   - `DAILY_QUOTA`: daily call limit for model requests. Shared across all visitors in open mode.
   - `ALLOWED_ORIGINS`: the site's own domain after deploy, e.g. `https://xxx.netlify.app`. Requests from elsewhere are rejected.
   - `DOMAIN_LOCK`: baked into the frontend at build time so the script only runs on that domain.

## Access control and data handling

Resumes are parsed in the browser. The file itself is never uploaded. By default, names, emails, phone numbers, ID numbers, social handles, addresses, and birthdates are masked before any request leaves the browser. The server is stateless, keeps no database, and logs no request body. Request size is capped near 80KB.

**Resumes are not stored anywhere, by design.**

Prompts and scoring rules live only in `server/`, inside Netlify Functions. The frontend never receives that logic, only the resulting JSON. `ALLOWED_ORIGINS` blocks requests that don't come from the site itself. With `ACCESS_CODES` set, each person uses a separate code, failed checks get a fixed delay to slow brute force, and model calls count against that code's daily quota while rule scoring stays free. Visitors can paste their own model key under Settings, so their usage counts against their own account, not the site owner's. The server also restricts which base URLs it will forward requests to.

The build step obfuscates `app.js`: identifiers are hashed, strings are encrypted, control flow is flattened. `DOMAIN_LOCK` ties the script to one domain. This raises the cost of copying the code, not more than that — the real protection is the server-side separation described above. Pages are marked noindex and nofollow. Response headers carry a content security policy that blocks inline scripts and limits `connect-src` to the site's own `/api/*`, plus `frame-ancestors none`, `X-Content-Type-Options`, and HSTS.

For stricter access, rotate codes on a schedule, use longer random strings, or add a login layer such as Cloudflare Access in front of Netlify.
