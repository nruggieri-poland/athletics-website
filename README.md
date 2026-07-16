# Poland Bulldogs Athletics

Replacement for polandbulldogs.org — an Astro static frontend backed by a
self-hosted Payload CMS, built as an npm workspaces monorepo.

## Layout

```
apps/cms/    Payload CMS (Next.js + Postgres) — schedules, teams, articles,
             site settings, the admin UI. The only thing that talks to Postgres.
apps/web/    Astro frontend — statically built from apps/cms's REST API at
             build time, rebuilt automatically whenever content is published.
packages/    Shared generated types (apps/cms's `generate:types` output).
scripts/     EventLink schedule sync, opponent-logo import, and production
             deploy tooling — see comments in each script.
```

## Local development

Requires Node ≥22.12.0 and a local Postgres instance.

```bash
npm install
cd apps/cms && cp .env.example .env   # fill in DATABASE_URI etc.
npm run migrate                        # create the schema
npm run dev                            # starts the CMS at localhost:3000
```

In another terminal:

```bash
cd apps/web && cp .env.example .env    # PAYLOAD_URL=http://localhost:3000
npm run dev                            # starts the site at localhost:4321
```

## Quality checks

```bash
npm run lint            # ESLint across apps/web, apps/cms, scripts/
npm run format           # Prettier — opt-in, not enforced in CI
npx astro check           # (from apps/web) TypeScript diagnostics
```

CI (`.github/workflows/ci.yml`) runs lint + a full build of both apps
(including a throwaway Postgres instance) on every pull request.

## Deploying

The server pulls for itself — nothing on GitHub's side ever pushes to or
runs commands on the server. A cron job on the server runs
[`scripts/deploy.sh`](scripts/deploy.sh) every 5 minutes, which no-ops if
there's nothing new, and otherwise pulls, installs/migrates/rebuilds only
what actually changed, and restarts the CMS via PM2. Content edits made in
the CMS admin deploy themselves separately and immediately, via the
rebuild-on-publish hook in `apps/cms/src/hooks/rebuildWeb.ts`.
