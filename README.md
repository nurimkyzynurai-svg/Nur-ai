# Viply — Go Viral. Effortlessly.

Viply is an AI content creation platform, built with React, React Router, Tailwind CSS v4 and Vite.

## Pages

- **`/`**: landing page with the hero, the 10 AI agents, how it works, and pricing (Start $97, Pro $199, Multi $349)
- **`/register`**: sign-up page with plan selection (it preselects the plan from `?plan=start|pro|multi`)
- **`/login`**: log-in page
- **`/dashboard`** (requires login): niche input, autopilot toggle, stats, and a monthly content calendar where you can add and delete posts for each day
- **`/dashboard/plan`** (requires login): Content Plan. Enter a campaign (name, any goal, start date, key date, vision, notes) and what goes out each day, or paste a whole plan. Choose **Execute as is** (the agents only turn each day into a script, hooks and captions) or **Improve it** (the Creative Director proposes a stronger campaign arc, shows every change and why, and waits for your approval). Results go into the Overview calendar, one item per day.
- **`/dashboard/create`** (requires login): Create Content page. Enter a niche, goal (Blogger or Business) and language, and fill in Voice Setup once. Then click Generate to watch each AI agent work live and get the final script, hooks, captions and quality score.

## AI agent team

Agent definitions live in `src/agents/`. Each file has a name, role, goal, system prompt, input format and JSON output schema. All agents use `claude-sonnet-5-5`.

| Agent | What it does |
|---|---|
| Brand DNA Agent | Turns example posts and Voice Setup answers into a style profile |
| Trend Agent | Suggests 10 trending ideas and picks the best one |
| Creative Director Agent | Turns the trend ideas into 3 bold, original concepts. The Director picks the strongest. In Content Plan's Improve mode, it improves the whole campaign |
| Hook Agent | Writes 5 hooks for the first 3 seconds |
| Script Agent | Writes the full script. On a rewrite it fixes every feedback item and lists what it changed. It avoids banned clichés and vague claims. For Business it ends with an exact keyword CTA (e.g. «Напишите слово ТОН») |
| Quality Agent | Scores virality and brand match from 1 to 10 and gives numbered feedback. Below 8, the script goes back to the Script Agent (4 drafts max). If no draft reaches 8, the best draft is shown labeled **Needs review** |
| Market Fit Agent | After the Quality Agent, checks the script against today's Market Brief: trend alignment, format freshness, platform fit, timing, differentiation and goal fit. Below 7, the script goes back to the Script Agent once. If it's still below 7, it's labeled **market risk**. It does no web searches |
| Caption Agent | Writes captions and hashtags for TikTok, Instagram, YouTube Shorts, LinkedIn and Threads |
| Market Intelligence Agent | Researches the live web with Anthropic's web search tool and saves a cited **Market Brief** per niche + platform + language. Every client with the same combination shares it, and it's refreshed at most once a day |
| Director Agent | Runs everything in order (`server/director.js`) and combines the final package |

Every agent's system prompt includes Viply's values (`src/agents/values.js`): quality first, understand the client, be decisive, think like a top specialist for the niche, give every piece a purpose, respect the client's plan, and be honest.

Every agent receives the Brand DNA profile, the goal and the content language (see `src/agents/shared.js`, which also holds the banned clichés list).

On every draft, `server/checks.js` also checks in code for banned clichés, a missing or unused Business keyword, and feedback the rewrite did not address. Any of these keeps the draft below the pass score, even if the Quality Agent missed it.

The backend (`server/`) is the only place the Anthropic API key is read. It comes from `.env`, which is git-ignored. The browser only calls `/api/generate`.

## Customer communication

- **FAQ** on the landing page (`#faq`). All questions and answers are in `src/content/faq.js`; edit that file to change them.
- **Feedback:** a "Suggest an idea / Report a problem" button on every dashboard page, plus a contact form in the landing footer. Messages go to `POST /api/feedback` and are saved in `data/feedback.json`.
  - All storage is in `server/feedback.js`, so moving to Supabase means rewriting only that file.
  - Spam protection: 5 messages per 10 minutes per IP (`server/rateLimit.js`), a hidden honeypot field and length limits. IP addresses are not stored.
- **Admin:** Market Intel → **Feedback** lists messages newest first, with an Open/All filter and a **Done** checkbox.
- **Contact email:** set `VITE_CONTACT_EMAIL` to show it in the landing footer. Without it, only the form is shown. Behind a hosting proxy, set `TRUST_PROXY=true` so the rate limit sees real visitor IPs.

## Voice input

- Every large text field has a **Dictate** button: Brand DNA inputs, the niche, campaign goal, vision, notes, plan days, the paste-a-plan box, proposal edits and the feedback form. The code is in `src/components/VoiceInput.jsx` and `src/lib/speech.js`.
- It uses the browser's Web Speech API. Text appears live and is **appended** to what's already there, and you can edit it afterwards. Click **Stop** to finish. A pulsing gold dot shows recording, and only one field records at a time.
- The recognition language follows the selected content language. A small dropdown overrides it, and the choice is remembered.
- Browsers without speech support (e.g. Firefox) see the hint "Voice input works in Chrome, Edge and Safari." A blocked microphone shows how to allow it.
- Viply never receives audio, only text. Note that the browser itself may use its maker's speech service (Chrome: Google, Safari: Apple).
- `values.js` tells every agent that input may be dictated: read for meaning, don't copy recognition errors, and never treat filler words as brand style.

## Niche: description + short label

- The niche is one shared field (Overview, Create Content, Content Plan): a **description in the client's own words** that grows as you type and has a mic, plus a **short label** of 1–5 words.
- The label is suggested automatically from the description by `POST /api/niche-label` (`src/agents/nicheLabelAgent.js`). That's one small Claude call that doesn't count as a free generation, with a simple first-words fallback. The user can edit the label, and suggestions stop until they click "Auto-suggest again".
- **Every agent** and the Market Intelligence research receive the full description. The **market-brief cache uses only the label** (niche label + platform + language), so the brief stays shared between clients in the same niche.

## Content Plan rules enforced in code (`server/plan.js`)

- Plans have at most 31 days and one item per date. The improved plan stays within the start date to the key date plus 14 days.
- Days marked **Keep exactly as written** always come back unchanged, even if the model edits them.
- Change labels (kept / improved / new / moved / removed) are recalculated from the real differences, not taken from the model.
- In both modes, every day's briefing tells the agents the item *is* the idea: no changes to its topic, offer, facts or call to action. The Quality Agent checks this.

## Market Intel

- **Every generation uses a Market Brief** for the client's niche + target platform + language. If none exists from the last 24 hours, one is researched on demand and shared with every client who has that combination. If web search fails, generation continues and is marked **Market data unavailable**: no trends are claimed and Market Fit is skipped. Failures are retried after 30 minutes, not on every request.
- **A compact brief** goes to the Trend, Creative Director, Hook, Script and Quality agents. It covers algorithm signals, rising formats, saturated formats and current tactics, plus topics and audience interests for the agents that generate ideas. It's context, not orders: Brand DNA, vision and plan come first.
- **"Why this can work now"** on the result shows the Market Fit score, the reason it can work, the main risk, one improvement, and source links. Sources that back no verified item are labeled **Unverified**.
- **Calls per generation** (Create Content, brief cached, Brand DNA saved): typically **9 Claude calls**. It's 12 if Market Fit sends the script back once, and up to **18** in the worst case (+1 the first time, when the Brand DNA is built). A new brief adds 2–4 research calls and up to 5 web searches, at most once a day per combination. The server logs every generation as `[generate] … N Claude calls (… agent + … research), M web searches, ~$X`.

- **Daily Market Brief per niche** (`src/agents/marketIntelAgent.js`). It covers platform algorithm changes (Instagram, TikTok, YouTube, Threads, LinkedIn, X), trending formats, sounds and topics, marketing and sales tactics, competitor activity and audience interests.
  - Every item has source links, and code marks anything without a real source as **Unverified** (`server/research.js`).
  - The Trend, Script, Quality and Director agents get the latest brief. A brief older than 24 hours is refreshed when a client generates content.
- **Weekly AI & Market Report** for the founder (`src/agents/founderReportAgent.js`). It covers new AI video, voice and image models, competitor updates, platform API changes, and concrete suggestions for Viply.
- **Market Intel admin tab** (`/admin/market-intel`). It's visible to emails in `VITE_ADMIN_EMAILS` and unlocked with `ADMIN_TOKEN`. It shows reports, briefs, the run log and costs.
- **Cost control:** each run has a search cap (`MARKET_BRIEF_MAX_SEARCHES`, `FOUNDER_REPORT_MAX_SEARCHES`) and there's a daily cap on scheduled briefs. Every run records its token and search usage and estimated cost (`server/cost.js`).
- **Scheduler:** `MARKET_INTEL_SCHEDULER=on` turns on an hourly check that refreshes briefs for combinations used in the last 14 days and writes the weekly report. The default is `off`: briefs are made on demand, and the admin tab has **Refresh now** and **Run now** buttons. The server logs at start whether the scheduler is on or off. Data is saved as JSON in `data/` (git-ignored).

## Getting started

```bash
npm install
cp .env.example .env   # then put your key in .env
npm run dev            # website on http://localhost:5173 + API server on :8787 (API restarts only on changes in server/ or src/agents/)
npm run build && npm start   # production: one server on :8787 serves the site and the API
```

To try the app without an API key, set `MOCK_AI=true` in `.env`. The agents will return built-in sample answers in English. Set `MOCK_AI=needs-review` to see a run where no draft reaches the pass score.

## Notes

- **Accounts are on the server:** `data/users.json` stores scrypt-hashed passwords, and `data/sessions.json` stores sessions as hashed tokens. All code is in `server/users.js`, so moving to Supabase means rewriting only that file. Brand DNA, plans and generated content still live in the browser. Accounts made with older versions (browser-only) need to sign up again.
- **Free early access:** each account gets `FREE_GENERATIONS` (default 3) generations, counted on the server in `data/usage.json` (`server/usage.js`). One Create Content run or one Content Plan day counts as one generation. Failed or stopped work isn't counted. Emails in `VITE_ADMIN_EMAILS` have no limit. When the limit is reached, the app shows a friendly message and a **Join early access** button, and the request appears in Market Intel → Feedback.
- Autopilot schedules one post per day for the next 30 days, based on your niche. Turning it off removes the upcoming autopilot posts and keeps your manual posts.
- Content for the agents and the pricing plans is in `src/data.js`.
