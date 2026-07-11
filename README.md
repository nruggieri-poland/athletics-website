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
             deploy/db-sync tooling — see comments in each script.
docs/        Deployment runbook, nginx configs — see docs/DEPLOY.md.
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

If you have access to the production database, `apps/cms`'s `npm run dev`
automatically pulls a fresh read-only snapshot down first (see
`scripts/sync-prod-db.sh` and `docs/DEPLOY.md`'s "Local database sync"
section) — local development then has realistic data without ever writing
to the live database.

## Quality checks

```bash
npm run lint            # ESLint across apps/web, apps/cms, scripts/
npm run format           # Prettier — opt-in, not enforced in CI
npx astro check           # (from apps/web) TypeScript diagnostics
```

CI (`.github/workflows/ci.yml`) runs lint + a full build of both apps
(including a throwaway Postgres instance) on every pull request.

## Deploying

See [`docs/DEPLOY.md`](docs/DEPLOY.md) — covers server setup, environment
variables, the zero-downtime deploy mechanism, Cloudflare/security
configuration, and the auto-deploy-on-push GitHub Actions workflow.
