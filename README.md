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
