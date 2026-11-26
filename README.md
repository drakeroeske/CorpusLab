# Corpus (CorpusLab)

Mobile-first, science-based training app. Current look: bone background, logo pink and black; Space Grotesk text, Archivo Black / Anton titles, bold Inter numbers. Design decisions live in [docs/](docs/README.md).

## Run locally

```bash
npm install
cp .env.example .env   # then fill in the values (ask Daniel; never commit .env)
npm run dev            # Vite + API on http://localhost:5000
```

Build and run the production bundle:

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

Typecheck: `npx tsc --noEmit -p .`

## Deploying to Vercel

`vercel.json` builds the client into `dist/public` and runs the Express API as one
serverless function (`api/index.ts` → `server/app.ts`). Node is pinned to 22.x.
In the Vercel project's **Settings → Environment Variables**, add the same values as `.env`:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CORPUS_DB_KEY`, `USDA_API_KEY`, `GOOGLE_PLACES_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
These live in Vercel (Settings → Environment Variables), not in the repo, so a new deployment needs them
entered again; redeploy after changing them. If several deployments share one Supabase database they must
use the same VAPID key pair, or existing notification subscriptions stop working.

Reminders (check-in, meals, streak) run on a 10-minute timer inside the Node process. Vercel functions
don't stay running, and the Hobby plan's cron runs at most once a day, so `.github/workflows/reminders.yml`
calls `POST /api/push/cron` (header `x-corpus-key: <CORPUS_DB_KEY>`) every 10 minutes from GitHub Actions.
It needs the repository secret `CORPUS_DB_KEY` (Settings → Secrets and variables → Actions). GitHub pauses
scheduled workflows after 60 days without commits; re-enable it from the Actions tab if that happens.

## Notifications

Web Push via the `web-push` package. The service worker (`client/public/sw.js`) shows notifications and
opens deep links like `/?go=train&sub=program`. Devices register in the `push_subscriptions` table;
event pushes fire from `server/routes.ts` via `notify()` and reminders live in `server/push.ts`.
The VAPID key pair in `.env` must be the same on every deployment that shares the database, or
existing subscriptions stop working. Generate once: `npx web-push generate-vapid-keys`.

## Secrets

`.env` holds the Supabase URL/anon key and the shared DB key. It is **never** committed —
this repo is public, and services like USDA deactivate any key they find on GitHub.
If you add a new key, put it in `.env` and in `.env.example` with an empty value.

## Layout

- `client/` — React + Vite app (`client/src/pages`, `client/src/components`, theme in `client/src/index.css`, Riso primitives in `client/src/components/riso.tsx`)
- `server/` — Express API (accounts, Spotters feed, food search proxy)
- `shared/` — types shared by both

## Working together

Pull before you start (`git pull`), work on a branch for anything big, open a PR, merge to `main`.
Live site: https://rxs-lab.pplx.app (published from `main` by Daniel's Perplexity Computer).
