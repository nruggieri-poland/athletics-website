# Deployment Runbook

Self-hosted, no Docker: one long-lived Node process (Payload/Next.js,
managed by PM2), Postgres installed directly on the box, nginx serving the
static Astro build directly from disk and reverse-proxying the CMS,
Cloudflare in front for DNS/CDN/WAF.

## 1. Server prerequisites

```bash
# Node (match .nvmrc)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Postgres
sudo apt-get install -y postgresql

# nginx
sudo apt-get install -y nginx

# PM2
sudo npm install -g pm2
```

Create the database and a least-privilege role:

```sql
CREATE ROLE athletics_app WITH LOGIN PASSWORD '<generate-a-strong-password>';
CREATE DATABASE athletics OWNER athletics_app;
```

## 2. Environment variables

Copy each `.env.example` to `.env` and fill in real values — never commit `.env`.

**apps/cms/.env**
```
DATABASE_URI=postgresql://athletics_app:<password>@localhost:5432/athletics
PAYLOAD_SECRET=<random 32+ char string>
PAYLOAD_SYNC_API_KEY=<random string, shared with scripts/schedule-sync/.env>
CF_ZONE_ID=<Cloudflare zone id>
CF_API_TOKEN=<Cloudflare token, scoped to Zone.Cache Purge only>
```

**apps/web/.env**
```
PAYLOAD_URL=http://127.0.0.1:3000
```

**scripts/schedule-sync/.env** (or GitHub Actions secrets, see §8)
```
PAYLOAD_URL=https://cms.<domain>
PAYLOAD_SYNC_API_KEY=<same value as apps/cms's PAYLOAD_SYNC_API_KEY>
```

## 3. Initial build

```bash
npm install
npm run build --workspace=apps/cms
npm run build --workspace=apps/web
```

The Payload build also needs to run migrations/generate against Postgres the
first time — see apps/cms's own README for `payload migrate` if using
migration-based schema management, or rely on `push: true` schema sync in
dev only (not recommended for production Postgres).

## 4. PM2

```bash
pm2 start ecosystem.config.cjs
pm2 startup   # follow the printed instructions to enable on-boot start
pm2 save
pm2 install pm2-logrotate
```

Common operations:
```bash
pm2 status
pm2 logs athletics-cms
```

## 5. nginx

Copy `docs/nginx.conf.example` to `/etc/nginx/sites-available/athletics`,
adjust `server_name`s, symlink into `sites-enabled`, then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Cloudflare

1. Add the domain to Cloudflare, point DNS records (`A`/`AAAA`) at this
   server's IP, orange-cloud (proxied) both the apex/`www` and `cms.` records.
2. SSL/TLS mode: "Full" (or "Full (strict)" once an origin certificate is
   installed — Cloudflare issues free origin certs for this).
3. Firewall: restrict inbound 80/443 on this server to Cloudflare's published
   IP ranges (https://www.cloudflare.com/ips/) plus SSH from your own IP.
4. Create an API token scoped to **Zone → Cache Purge** only for the
   `CF_API_TOKEN` env var above — not the Global API Key.
5. Optional: a Cache Rule for `cms.<domain>/*` set to "Bypass cache" so the
   admin UI/API is never edge-cached.

## 7. Rebuild-on-publish

Payload's `afterChange`/`afterDelete` hooks (registered on Sports, Teams,
Games, Articles, and the SiteSettings/Navigation globals — see
`apps/cms/src/hooks/scheduleRebuildHooks.ts`) call `scheduleRebuild()`
(`apps/cms/src/hooks/rebuildWeb.ts`) whenever a document changes. That
function debounces for 45s (so a burst of edits or an EventLink sync run
touching dozens of Games triggers one rebuild, not dozens), then runs
`npm run build` in `apps/web` — since Astro is a static build with no
running server process, the moment the build finishes the new files are
live; nginx just reads them off disk. It then purges Cloudflare's cache via
the `CF_ZONE_ID`/`CF_API_TOKEN` env vars. If those aren't set, the purge is
skipped with a warning (useful for local dev) but the rebuild still runs.

## 8. Schedule sync

The `nruggieri-poland/schedules` repo already runs its own GitHub Actions
workflow every ~15 minutes, pulling EventLink and publishing per-team JSON
to `dist/teams/*.json` (readable via raw.githubusercontent.com). Nothing
about that pipeline needs to change.

`scripts/schedule-sync/pull-and-sync.js` is the other side: it fetches each
team's published JSON directly from that repo and pushes it into Payload's
`/api/import-feed` endpoint. Run it on a schedule (cron on this server, or
a GitHub Actions workflow in this repo once it's pushed to GitHub):

```bash
node scripts/schedule-sync/pull-and-sync.js
```

Needs these env vars (see `scripts/schedule-sync/.env.example`):

```
PAYLOAD_URL              # public URL of apps/cms, e.g. https://cms.<domain>
PAYLOAD_SYNC_API_KEY     # matches PAYLOAD_SYNC_API_KEY configured in apps/cms
```

Example crontab entry (every 15 minutes):
```
*/15 * * * * cd /var/www/athletics-website && node scripts/schedule-sync/pull-and-sync.js >> /var/log/schedule-sync.log 2>&1
```

## 9. Cutover

1. QA the new site fully on a staging subdomain first.
2. Point the production domain's DNS at this server through Cloudflare.
3. Keep the WordPress site + `athletics-plugin` + old `schedules/` GitHub
   Actions workflow available (disabled, not deleted) for a short rollback
   window.

## 10. Backups

```bash
# Nightly cron, e.g. via crontab -e
0 3 * * * pg_dump athletics | gzip > /var/backups/athletics-$(date +\%F).sql.gz
```
Rotate/offload old dumps (e.g. `rclone` to a free-tier object storage bucket)
— not configured here, decide based on what you already use.
