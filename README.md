# RXS (CorpusLab)

Mobile-first, science-based training engine. Riso Lab design: paper / ink / cobalt, Anton + Archivo Black + Space Mono.

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
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CORPUS_DB_KEY`, `USDA_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

Reminders (check-in, meals, streak) run on a 10-minute timer inside the Node process. Vercel functions
don't stay running, so on Vercel schedule a job that calls `POST /api/push/cron` every 10 minutes with
header `x-corpus-key: <CORPUS_DB_KEY>` (Vercel Cron or any external scheduler).

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
