// Only apps/cms runs as a long-lived process. apps/web is a fully static
// Astro build (`astro build`, output: 'static') — nginx serves
// apps/web/current (a symlink flipped by apps/web/deploy-build.sh) directly
// from disk, so there's no Node process to manage for the public site.
// Rebuild-on-publish (apps/cms/src/hooks/rebuildWeb.ts) runs that same
// deploy-build.sh script — see its comment for why a plain `npm run build`
// isn't safe (it clears the live directory nginx is actively serving from).
module.exports = {
  apps: [
    {
      name: 'athletics-cms',
      cwd: './apps/cms',
      script: './node_modules/.bin/next',
      // Bind to localhost only — nginx is the only intended way in. This is
      // defense in depth on top of the firewall (docs/DEPLOY.md §2/§8c):
      // without -H, Next's `start` defaults to 0.0.0.0, meaning a firewall
      // lapse (a reboot before `ufw enable` reruns, a rule fat-fingered
      // during the Cloudflare-IP-range migration, etc.) would leave the
      // full Payload admin/API — including /api/users/login — reachable
      // directly on the droplet's public IP with no TLS, no WAF, nothing.
      args: 'start -H 127.0.0.1 -p 3000',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
