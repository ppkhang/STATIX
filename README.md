# STATIX

Store for STATIX numbered desk-audio drops. Next.js 16, TypeScript, Postgres with Drizzle, next-intl (Vietnamese default, English under `/en`).

Plan: [docs/BUILD.md](docs/BUILD.md) · Pages: [docs/PAGES_UI.md](docs/PAGES_UI.md) · Look: [DESIGN.md](DESIGN.md)

## Run it locally

Needs Node 24 and Docker.

```sh
npm install
cp .env.example .env.local   # local defaults work for the database
npm run db:up                # Postgres in Docker
npm run db:migrate
npm run db:seed              # tiers, 4 products, Drop 001 with 500-unit editions
npm run dev                  # http://localhost:3000
```

Schema changes: edit `src/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate`.

## Layout

| Path | What |
|---|---|
| `src/app/[locale]/(landing)/` | Landing page: the original `index.html` markup; script in `public/landing.js` |
| `src/app/[locale]/(site)/` | Every other customer page, inside the shared menu and footer |
| `src/app/globals.css` | Design tokens and the landing styles |
| `src/db/` | Schema and client |
| `messages/` | VI and EN strings |
| `index.html` | Original standalone landing, kept as the reference for `docs/INTERACTABLES.md` |
