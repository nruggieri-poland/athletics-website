# Deployment Runbook

Self-hosted, no Docker: one long-lived Node process (Payload/Next.js,
managed by PM2), Postgres installed directly on the box, nginx serving the
static Astro build directly from disk and reverse-proxying the CMS, TLS via
Let's Encrypt (certbot). Written from an actual from-scratch deployment —
every command here was run in order against a fresh Ubuntu 24.04 droplet and
verified working, not written speculatively.

Replace `<domain>` and `<cms-domain>` below with your real domains
(e.g. `polandbulldogs.org` and `cms.polandbulldogs.org`).

## 1. Server prerequisites

Fresh Ubuntu 24.04 droplet, minimum 2GB RAM. Add swap first — `npm install`
and running the CMS build alongside a live Next.js process can spike memory
past what a 2GB box has free, and without swap the OOM killer silently kills
the install partway through:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Install Node, Postgres, nginx, PM2:

```bash
# Node — must be 22.12.0 or newer (matches .nvmrc / package.json engines).
# 20.x will fail the CMS build with type errors that only surface under
# strict production type-checking, not in dev.
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql nginx
sudo npm install -g pm2
```

Create the database and a least-privilege role (never use the `postgres`
superuser role for the app):

```bash
sudo -u postgres psql -c "CREATE ROLE athletics_app WITH LOGIN PASSWORD '<generate-a-strong-password>';"
sudo -u postgres psql -c "CREATE DATABASE athletics OWNER athletics_app;"
```

Generate that password with something like `openssl rand -base64 24`, not by
hand — save it somewhere secure (password manager), you'll need it in §3.

## 2. Firewall

Lock the box down **before** anything is publicly reachable. Only SSH, HTTP,
and HTTPS should ever be open to the internet — the CMS (port 3000) and
Postgres (port 5432) must only be reachable from `localhost`, via nginx's
reverse proxy:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose   # confirm only 22/80/443 are listed
```

Postgres already defaults to listening on `localhost` only on a stock Ubuntu
install — don't change `postgresql.conf`'s `listen_addresses` to `*`.

## 3. Get the code onto the server

Use a **deploy key**, not a personal access token or password — it's scoped
to read-only access to this one repo, easy to revoke, and never expires
silently the way a PAT does.

```bash
ssh-keygen -t ed25519 -C "<server-hostname>-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Add that public key on GitHub: repo → **Settings → Deploy keys → Add deploy
key** → paste it in → leave "Allow write access" **unchecked** (read-only).

```bash
ssh-keyscan -H github.com >> ~/.ssh/known_hosts
sudo mkdir -p /var/www
sudo chown $(whoami) /var/www
git clone git@github.com:<org>/athletics-website.git /var/www/athletics-website
cd /var/www/athletics-website
```

## 4. Environment variables

Never commit `.env` files — create them directly on the server.

**apps/cms/.env**
```
DATABASE_URI=postgresql://athletics_app:<password-from-step-1>@localhost:5432/athletics
PAYLOAD_SECRET=<random 32+ char string — e.g. `openssl rand -base64 32`>
PAYLOAD_SYNC_API_KEY=<random string — e.g. `openssl rand -base64 24` — shared with scripts/schedule-sync/.env>
```
Optional, only if using Cloudflare in front (see note in §7):
```
CF_ZONE_ID=<Cloudflare zone id>
CF_API_TOKEN=<Cloudflare token, scoped to Zone.Cache Purge only>
```

**apps/web/.env**
```
PAYLOAD_URL=https://<cms-domain>
```
This **must** be the public HTTPS URL of the CMS, not `http://127.0.0.1:3000`.
It's used both for the build-time API fetch (fine either way, same box) and
to construct every image/upload URL baked into the static HTML (`<img src>`
etc.) — the visitor's browser has to be able to reach that URL directly. Set
it to localhost and every image on the live site breaks (and on an HTTPS
page, browsers block the request outright as mixed content, so the failure
mode is a hard error, not just a broken image icon).

**scripts/schedule-sync/.env**
```
PAYLOAD_URL=http://localhost:3000
PAYLOAD_SYNC_API_KEY=<same value as apps/cms's PAYLOAD_SYNC_API_KEY>
```
This one *is* fine as localhost — it's a script running on the same box,
never reaches a browser.

## 5. Install dependencies and create the database schema

```bash
npm install
```

Payload only auto-pushes schema changes in dev mode — production requires
running the checked-in migration explicitly. **Do this before building or
starting anything**, or the CMS boots with zero tables and every API request
fails:

```bash
npm run migrate --workspace=apps/cms
```

**Whenever a collection/global/field changes going forward**, generate a new
migration locally (on your own machine, against your local dev database) and
commit it before deploying:

```bash
npm run migrate:create --workspace=apps/cms -- <short_description>
```

Open the generated file in `apps/cms/src/migrations/` and split its first
line — change
`import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'`
into two lines:
```ts
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
```
The generator emits a combined import that Node's native TypeScript
stripping can't resolve at runtime (fails with `does not provide an export
named 'MigrateDownArgs'`). Then, on the server: `git pull && npm run migrate
--workspace=apps/cms` before rebuilding.

## 6. Build and start the CMS

```bash
npm run build --workspace=apps/cms
pm2 start ecosystem.config.cjs
pm2 status
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/sports   # expect 200
```

Make PM2 survive a server reboot:

```bash
pm2 startup            # if not running as root, copy/paste the sudo command it prints
pm2 save
pm2 install pm2-logrotate
```

## 7. Build the static site

The CMS **must** already be running (previous step) before this — Astro
fetches data from it at build time to generate every page:

```bash
chmod +x apps/web/deploy-build.sh
./apps/web/deploy-build.sh
```

Don't run `npm run build --workspace=apps/web` directly on the server —
`deploy-build.sh` wraps it. Here's why it matters: Astro clears its output
directory at the start of every build. If nginx points straight at that
directory (the naive setup), every rebuild — including the *automatic* ones
triggered by publishing an article — makes the live site 404 for the few
seconds the build takes. `deploy-build.sh` builds into an offline directory
(alternating `dist-blue`/`dist-green`) and only atomically flips a `current`
symlink once the build finishes successfully. nginx's `root` points at
`current`, never at a directory mid-rebuild. This was verified under a live
concurrent load test — 200/200 requests succeeded through a full
rebuild-and-swap cycle.

## 8. nginx + TLS

Copy `docs/nginx.conf.example` (or `docs/nginx-athleticstest.conf` for a
reference of the exact config used for the test deployment) to
`/etc/nginx/sites-available/athletics`, set the real `server_name`s, and
**make sure `root` points at `apps/web/current`, not `apps/web/dist`** (see
§7 for why). Then:

```bash
sudo ln -sf /etc/nginx/sites-available/athletics /etc/nginx/sites-enabled/athletics
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Issue real certificates with certbot (requires DNS for both domains already
pointing at this server's IP — `dig <domain> +short` and `dig <cms-domain>
+short` should both return this server's IP before running this):

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <domain> -d <cms-domain> --redirect --agree-tos -m <your-email> --no-eff-email
```

This edits the nginx config in place to add the `listen 443 ssl;` blocks and
an HTTP→HTTPS redirect. Renewal is automatic via a systemd timer certbot
installs — confirm it's active:

```bash
systemctl status certbot.timer --no-pager
sudo certbot renew --dry-run   # should end with "Congratulations, all simulated renewals succeeded"
```

**Optional — Cloudflare in front:** if you later put Cloudflare (orange-cloud
DNS) in front of this server instead of DNS pointing directly at it, set
`CF_ZONE_ID`/`CF_API_TOKEN` in `apps/cms/.env` (§4) so the rebuild hook
purges Cloudflare's edge cache after every publish, restrict inbound 80/443
in step 2's firewall to Cloudflare's published IP ranges
(https://www.cloudflare.com/ips/), and set Cloudflare's SSL/TLS mode to
"Full (strict)". Not required — the setup above (direct DNS + certbot) is a
complete, secure deployment on its own.

## 9. Rebuild-on-publish (already automatic)

Payload's `afterChange`/`afterDelete` hooks (registered on Sports, Teams,
Games, Articles, Documents, and the SiteSettings/Navigation globals — see
`apps/cms/src/hooks/scheduleRebuildHooks.ts`) call `scheduleRebuild()`
(`apps/cms/src/hooks/rebuildWeb.ts`) whenever a document changes in the CMS
admin. That function debounces for 45 seconds (so a burst of edits, or an
EventLink sync run touching dozens of Games, triggers one rebuild, not
dozens), then runs `deploy-build.sh` — the zero-downtime build+swap from §7.
Nothing to configure; this just works once PM2 is running the CMS process
with the right working directory (which `pm2 start ecosystem.config.cjs`
already sets up).

## 10. Schedule sync (EventLink)

The `nruggieri-poland/schedules` repo runs its own GitHub Actions workflow
every ~15 minutes, pulling EventLink and publishing per-team JSON. This
server's side pulls that JSON and pushes it into Payload:

```bash
crontab -l 2>/dev/null > /tmp/current-cron
cat >> /tmp/current-cron << 'EOF'
*/15 * * * * cd /var/www/athletics-website && node --env-file=scripts/schedule-sync/.env scripts/schedule-sync/pull-and-sync.js >> /var/log/schedule-sync.log 2>&1
EOF
crontab /tmp/current-cron
```

The `--env-file` flag matters — `pull-and-sync.js` reads `process.env`
directly and has no `.env`-loading logic of its own, so without it the
script silently no-ops with `PAYLOAD_URL not set — skipping push to
Payload.` (no error, no games synced, easy to miss).

## 11. Backups

```bash
sudo mkdir -p /var/backups
crontab -l 2>/dev/null > /tmp/current-cron
cat >> /tmp/current-cron << 'EOF'
0 3 * * * pg_dump athletics | gzip > /var/backups/athletics-$(date +\%F).sql.gz
0 4 * * * find /var/backups -name "athletics-*.sql.gz" -mtime +30 -delete
EOF
crontab /tmp/current-cron
```

Nightly dump at 3 AM, pruned after 30 days. Consider also syncing
`/var/backups` offsite (e.g. `rclone` to a free-tier object storage bucket)
— not configured here, decide based on what you already use. Also back up
`apps/cms/media/` (uploaded files — logos, PDFs, photos) separately; it's
not in the database dump.

## 12. Populating content

Structural/reference data has one-off scripts — run these once after the
first deploy (from `apps/cms/`):

```bash
npm run seed:teams          # 43 teams from scripts/schedule-sync/pshs-athletics-teams.csv
npm run seed:navigation     # initial header/footer nav links
```

Anything else — Articles, Site Settings (logo, colors, hero video, social
links, address), individual Sports' hero video IDs, opponent logos — was
entered by hand in the local dev CMS during development and has to be
either re-entered in the production admin UI (`https://<cms-domain>/admin`)
or migrated over deliberately. For hero video IDs specifically, there's a
reusable script — export `Sport,Video ID` CSV rows and run:

```bash
npm run import:hero-videos --workspace=apps/cms -- <path-to-csv>
```

Opponent team logos (`scripts/opponent-logos/`) are gitignored (hundreds of
image files, not meant to live in git) — transfer them with `rsync` from a
machine that has them, then run:

```bash
npm run attach:logos --workspace=apps/cms
```

## 13. Cutover

1. QA the new site fully on a staging subdomain first (this runbook's own
   trial run used `athleticstest.<domain>` for exactly this).
2. Point the production domain's DNS at this server.
3. Re-run the certbot command in §8 for the production domain if it's
   different from the staging one.
4. Keep the old WordPress site + `athletics-plugin` + old `schedules/`
   GitHub Actions workflow available (disabled, not deleted) for a short
   rollback window.

## Security checklist

Everything above adds up to this — use it to sanity-check any deployment,
including ones done differently from this exact runbook:

- [ ] Firewall (`ufw` or equivalent) allows only 22, 80, 443 from the public
      internet. Postgres (5432) and the CMS's raw Node port (3000) are
      **not** publicly reachable — only via `localhost`/nginx.
- [ ] SSH: key-based auth only. This runbook didn't disable password auth or
      root login explicitly — if that matters for your compliance posture,
      also set `PasswordAuthentication no` and `PermitRootLogin
      prohibit-password` in `/etc/ssh/sshd_config` and restart `sshd`.
- [ ] GitHub access uses a read-only deploy key scoped to this one repo, not
      a personal access token or a developer's own SSH key.
- [ ] `.env` files exist only on the server (and in each developer's local
      checkout), never committed — verify with `git log --all --full-history
      -- '**/.env'` (should return nothing) before ever pushing.
- [ ] Postgres app role (`athletics_app`) is not a superuser and owns only
      the `athletics` database — the app never connects as `postgres`.
- [ ] All public traffic is HTTPS (nginx redirects HTTP→HTTPS after certbot
      runs); certificate auto-renewal (`certbot.timer`) is active.
- [ ] `PAYLOAD_SECRET` and `PAYLOAD_SYNC_API_KEY` are long random values
      (`openssl rand -base64 32`), not guessable strings.
- [ ] Nightly database backups are running and have actually produced a
      recent file in `/var/backups` — check, don't just assume the cron job
      works.
- [ ] PM2 survives a reboot (`pm2 startup` + `pm2 save` both run) — test
      this once with an actual `sudo reboot` before considering the
      deployment done.
