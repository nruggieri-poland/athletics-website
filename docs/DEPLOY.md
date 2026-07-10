# Deployment Runbook

Self-hosted, no Docker: one long-lived Node process (Payload/Next.js,
managed by PM2), Postgres installed directly on the box, nginx serving the
static Astro build directly from disk and reverse-proxying the CMS,
Cloudflare in front for DNS, TLS, caching, and WAF. Written from an actual
from-scratch deployment — every command in §1-§7 and §9-§12 was run in order
against a fresh Ubuntu 24.04 droplet and verified working (on a test domain);
§8's Cloudflare setup is the recommended production path but wasn't
exercised live in that trial run, so treat its commands as correct-per-docs
rather than battle-tested — sanity-check each step as you go.

Target domains: `polandbulldogs.org` (main site) and
`cms.polandbulldogs.org` (CMS admin/API). Substitute your own if different.

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
git clone git@github.com:nruggieri-poland/athletics-website.git /var/www/athletics-website
cd /var/www/athletics-website
```

## 4. Environment variables

Never commit `.env` files — create them directly on the server.

**apps/cms/.env**
```
DATABASE_URI=postgresql://athletics_app:<password-from-step-1>@localhost:5432/athletics
PAYLOAD_SECRET=<random 32+ char string — e.g. `openssl rand -base64 32`>
PAYLOAD_SYNC_API_KEY=<random string — e.g. `openssl rand -base64 24` — shared with scripts/schedule-sync/.env>
CF_ZONE_ID=<Cloudflare zone id — see §8>
CF_API_TOKEN=<Cloudflare token, scoped to Zone.Cache Purge only — see §8>
```

**apps/web/.env**
```
PAYLOAD_URL=https://cms.polandbulldogs.org
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

## 8. nginx + Cloudflare (DNS, TLS, caching, WAF)

Copy `docs/nginx.conf.example` to `/etc/nginx/sites-available/athletics`,
confirm the `server_name`s match `polandbulldogs.org`/`cms.polandbulldogs.org`,
and **make sure `root` points at `apps/web/current`, not `apps/web/dist`**
(see §7 for why). Then:

```bash
sudo ln -sf /etc/nginx/sites-available/athletics /etc/nginx/sites-enabled/athletics
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 8a. Cloudflare DNS

Add `polandbulldogs.org` to Cloudflare (Cloudflare will give you two
nameservers to set at your domain registrar — do that first, wait for it to
show "Active" in the Cloudflare dashboard, then continue). Add these DNS
records, both **proxied** (orange cloud, not grey/DNS-only):

```
Type: A    Name: @      Content: <droplet-ip>    Proxy: Proxied
Type: A    Name: www    Content: <droplet-ip>    Proxy: Proxied
Type: A    Name: cms    Content: <droplet-ip>    Proxy: Proxied
```

### 8b. Origin certificate

With Cloudflare proxying, visitors' browsers only ever talk TLS to
Cloudflare — but Cloudflare still needs to talk TLS to this server. Use a
Cloudflare **Origin Certificate** instead of Let's Encrypt: it's free,
valid for 15 years (no renewal cron to babysit), and — usefully — only
trusted by Cloudflare itself, so someone who discovers your droplet's raw IP
and tries to hit it directly over HTTPS gets a certificate error instead of
bypassing Cloudflare's WAF/caching entirely.

In the Cloudflare dashboard: **SSL/TLS → Origin Server → Create Certificate**
(defaults are fine — RSA, includes both `polandbulldogs.org` and
`*.polandbulldogs.org`, 15 years). It gives you a certificate and a private
key — save them on the server:

```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo nano /etc/ssl/cloudflare/cert.pem   # paste the certificate
sudo nano /etc/ssl/cloudflare/key.pem    # paste the private key
sudo chmod 600 /etc/ssl/cloudflare/key.pem
```

Add `listen 443 ssl;` blocks to `/etc/nginx/sites-available/athletics`
referencing those two files (`ssl_certificate
/etc/ssl/cloudflare/cert.pem;` / `ssl_certificate_key
/etc/ssl/cloudflare/key.pem;`) for both the main-site and CMS server blocks,
plus a `server { listen 80; return 301 https://$host$request_uri; }` block
to redirect any stray HTTP request. Then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

In the Cloudflare dashboard: **SSL/TLS → Overview → set mode to "Full
(strict)"**. This requires the origin to present a valid certificate (which
it now does) — never use "Flexible" mode, which leaves the Cloudflare-to-
server hop unencrypted.

### 8c. Firewall: restrict origin access to Cloudflare only

With Cloudflare proxying, nothing should reach this server on 80/443 except
Cloudflare's own edge servers — this stops anyone from bypassing Cloudflare's
WAF/rate-limiting by hitting the droplet's IP directly:

```bash
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do sudo ufw allow from $ip to any port 80,443 proto tcp; done
for ip in $(curl -s https://www.cloudflare.com/ips-v6); do sudo ufw allow from $ip to any port 80,443 proto tcp; done
sudo ufw status verbose
```

Cloudflare's IP ranges change occasionally — re-run this (or automate it
with a cron job hitting those same URLs) every few months.

### 8d. Caching

The rebuild hook (`apps/cms/src/hooks/rebuildWeb.ts`) already purges
Cloudflare's cache automatically after every publish (once `CF_ZONE_ID`/
`CF_API_TOKEN` are set in `apps/cms/.env` — see §4; generate the token under
**My Profile → API Tokens → Create Token**, scoped to **Zone → Cache
Purge → polandbulldogs.org only**, nothing broader). That makes it safe to
cache aggressively:

- **Rules → Cache Rules → Create rule**: match `hostname equals
  polandbulldogs.org OR hostname equals www.polandbulldogs.org`, set
  **Eligible for cache** + **Edge TTL: Cache Everything** (Cloudflare
  doesn't cache HTML by default even with a permissive `Cache-Control`
  header — this override is what actually caches page loads, not just
  static assets). Safe here specifically because publish-time purge means
  stale content never lingers past a rebuild.
- **Rules → Cache Rules → Create rule**: match `hostname equals
  cms.polandbulldogs.org`, set **Bypass cache**. The admin UI and API are
  always dynamic — never cache them.

### 8e. WAF and bot protection

**Security → WAF → Managed Rules**: turn on the free "Cloudflare Managed
Ruleset" and "Cloudflare OWASP Core Ruleset" — blocks common SQLi/XSS/known-
exploit patterns before they ever reach the server.

**Security → Bots**: enable "Bot Fight Mode" (free tier) — challenges
obvious bot/scraper traffic.

**Security → WAF → Rate limiting rules**: add a rule for
`cms.polandbulldogs.org/api/users/login` (Payload's auth endpoint) — e.g.
block an IP for 10 minutes after 5 requests in 1 minute. Protects the CMS
login from brute-force attempts. (Rate limiting rules are available on the
free plan with a limited rule count as of this writing — confirm current
Cloudflare plan limits if this rule doesn't save.)

### 8f. Alternative: no Cloudflare

If you'd rather not put Cloudflare in front (e.g. DNS stays pointed directly
at the droplet), use Let's Encrypt instead — simpler to set up, no account
needed, but you lose the caching/WAF/DDoS-absorption benefits above:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d polandbulldogs.org -d cms.polandbulldogs.org --redirect --agree-tos -m <your-email> --no-eff-email
systemctl status certbot.timer --no-pager   # confirm auto-renewal is active
sudo certbot renew --dry-run                # should end with "Congratulations, all simulated renewals succeeded"
```
In this case, leave the firewall as plain `22/80/443 allow from anywhere`
(§2) rather than restricting to Cloudflare's ranges (§8c), and leave
`CF_ZONE_ID`/`CF_API_TOKEN` unset in `apps/cms/.env` — the rebuild hook
skips the purge step with a warning if they're not set, no error.

### 8g. Cookie consent (OneTrust or similar)

Not part of getting the site running, but worth flagging before public
launch: if the site sets any cookies for analytics/tracking (Google
Analytics, a Facebook pixel, etc. — currently nothing in this codebase does,
but likely to get added later), most US states and virtually all of Europe
require a consent banner before those cookies fire, and this being a school
site makes privacy compliance worth taking seriously regardless of which
specific law applies. OneTrust (or a lighter-weight alternative like
Cookiebot/Osano) is a reasonable choice.

This isn't wired into the codebase yet — there's nothing to consent to
until a tracking script actually gets added. When one does: OneTrust's
setup gives you a snippet like
```html
<script src="https://cdn.cookielaw.org/scripttemplates/otSDKStub.js" data-domain-script="<your-id>"></script>
```
which needs to load as early as possible in `<head>`, before any other
tracking script — in this codebase, that's the top of
`apps/web/src/layouts/BaseLayout.astro`'s `<head>` block, right after the
`<meta charset>` line. Any tracking scripts added after that point should
be wrapped so they only fire once OneTrust reports consent was given (its
docs cover the exact API for this — differs by category of cookie).

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
either re-entered in the production admin UI (`https://cms.polandbulldogs.org/admin`)
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

1. QA the new site fully on a staging subdomain first (e.g.
   `athleticstest.<some-other-domain>` — this was the actual pattern used to
   validate this runbook before writing it up for `polandbulldogs.org`).
2. Add `polandbulldogs.org` to Cloudflare and point its DNS at this server
   (§8a), rather than reusing whatever DNS setup the staging subdomain used.
3. Complete §8b-§8e (origin cert, firewall restricted to Cloudflare IPs,
   caching, WAF) for the production domain.
4. Keep the old WordPress site + `athletics-plugin` + old `schedules/`
   GitHub Actions workflow available (disabled, not deleted) for a short
   rollback window.

## Security checklist

Everything above adds up to this — use it to sanity-check any deployment,
including ones done differently from this exact runbook:

- [ ] Firewall (`ufw` or equivalent) allows 22/80/443 only from Cloudflare's
      published IP ranges (§8c) — not "anywhere" — if using Cloudflare (§8f
      if not). Postgres (5432) and the CMS's raw Node port (3000) are
      **not** publicly reachable either way — only via `localhost`/nginx.
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
- [ ] All public traffic is HTTPS: Cloudflare SSL/TLS mode is "Full
      (strict)" (never "Flexible" — that leaves Cloudflare-to-origin
      unencrypted), origin certificate is installed and not expired (15-year
      validity, but verify it's actually the Cloudflare one and not a
      leftover self-signed cert), and nginx redirects HTTP→HTTPS.
- [ ] Cloudflare WAF managed rulesets + Bot Fight Mode are enabled (§8e);
      cache purge (`CF_ZONE_ID`/`CF_API_TOKEN`) is configured and actually
      firing — check the CMS logs after a test publish for `[rebuild]
      Cloudflare cache purged.`.
- [ ] `PAYLOAD_SECRET` and `PAYLOAD_SYNC_API_KEY` are long random values
      (`openssl rand -base64 32`), not guessable strings.
- [ ] Nightly database backups are running and have actually produced a
      recent file in `/var/backups` — check, don't just assume the cron job
      works.
- [ ] PM2 survives a reboot (`pm2 startup` + `pm2 save` both run) — test
      this once with an actual `sudo reboot` before considering the
      deployment done.
- [ ] If any analytics/tracking script gets added to the site later, a
      cookie consent banner (§8g) goes in *before* it, not after.
