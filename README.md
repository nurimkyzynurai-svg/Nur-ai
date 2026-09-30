# Viply — Go Viral. Effortlessly.

Viply is an AI content creation platform, built with React, React Router, Tailwind CSS v4 and Vite.

## Pages

- **`/`**: landing page with the hero, the 10 AI agents, how it works, and pricing (Start $97, Pro $199, Multi $349)
- **`/register`**: sign-up page with plan selection (it preselects the plan from `?plan=start|pro|multi`)
- **`/login`**: log-in page
- **`/dashboard`** (requires login): niche input, autopilot toggle, stats, and a monthly content calendar where you can add and delete posts for each day

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Notes

- Authentication is a **front-end demo** with no backend. Accounts (with SHA-256 password hashes), the session, and dashboard data are stored in the browser's `localStorage`. Before going to production, replace the functions in `src/context/AuthContext.jsx` with a real auth API.
- Autopilot schedules one post per day for the next 30 days, based on your niche. Turning it off removes the upcoming autopilot posts and keeps your manual posts.
- Content for the agents and the pricing plans is in `src/data.js`.
