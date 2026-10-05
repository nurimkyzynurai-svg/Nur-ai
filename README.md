# Viply — Go Viral. Effortlessly.

Viply is an AI content creation platform, built with React, React Router, Tailwind CSS v4 and Vite.

## Pages

- **`/`**: landing page with the hero, the 10 AI agents, how it works, and pricing (Start $97, Pro $199, Multi $349)
- **`/register`**: sign-up page with plan selection (it preselects the plan from `?plan=start|pro|multi`)
- **`/login`**: log-in page
- **`/dashboard`** (requires login): niche input, autopilot toggle, stats, and a monthly content calendar where you can add and delete posts for each day
- **`/dashboard/create`** (requires login): Create Content page. Enter a niche, goal (Blogger or Business) and language, and fill in Voice Setup once. Then click Generate to watch each AI agent work live and get the final script, hooks, captions and quality score.

## AI agent team

Agent definitions live in `src/agents/`. Each file has a name, role, goal, system prompt, input format and JSON output schema. All agents use `claude-sonnet-5-5`.

| Agent | What it does |
|---|---|
| Brand DNA Agent | Turns example posts and Voice Setup answers into a style profile |
| Trend Agent | Suggests 10 trending ideas and picks the best one |
| Hook Agent | Writes 5 hooks for the first 3 seconds |
| Script Agent | Writes the full script. On a rewrite it fixes every feedback item and lists what it changed. It avoids banned clichés and vague claims. For Business it ends with an exact keyword CTA (e.g. «Напишите слово ТОН») |
| Quality Agent | Scores virality and brand match from 1 to 10 and gives numbered feedback. Below 8, the script goes back to the Script Agent (4 drafts max). If no draft reaches 8, the best draft is shown labeled **Needs review** |
| Caption Agent | Writes captions and hashtags for TikTok, Instagram, YouTube Shorts, LinkedIn and Threads |
| Director Agent | Runs everything in order (`server/director.js`) and combines the final package |

Every agent receives the Brand DNA profile, the goal and the content language (see `src/agents/shared.js`, which also holds the banned clichés list).

On every draft, `server/checks.js` also checks in code for banned clichés, a missing or unused Business keyword, and feedback the rewrite did not address. Any of these keeps the draft below the pass score, even if the Quality Agent missed it.

The backend (`server/`) is the only place the Anthropic API key is read. It comes from `.env`, which is git-ignored. The browser only calls `/api/generate`.

## Getting started

```bash
npm install
cp .env.example .env   # then put your key in .env
npm run dev            # website on http://localhost:5173 + API server on :8787
npm run build && npm start   # production: one server on :8787 serves the site and the API
```

To try the app without an API key, set `MOCK_AI=true` in `.env`. The agents will return built-in sample answers in English. Set `MOCK_AI=needs-review` to see a run where no draft reaches the pass score.

## Notes

- Authentication is a **front-end demo** with no backend. Accounts (with SHA-256 password hashes), the session, and dashboard data are stored in the browser's `localStorage`. Before going to production, replace the functions in `src/context/AuthContext.jsx` with a real auth API.
- Autopilot schedules one post per day for the next 30 days, based on your niche. Turning it off removes the upcoming autopilot posts and keeps your manual posts.
- Content for the agents and the pricing plans is in `src/data.js`.
