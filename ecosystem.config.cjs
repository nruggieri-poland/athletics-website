// Only apps/cms runs as a long-lived process. apps/web is a fully static
// Astro build (`astro build`, output: 'static') — nginx serves
// apps/web/dist directly from disk, so there's no Node process to manage
// for the public site. Rebuild-on-publish (apps/cms/src/hooks/rebuildWeb.ts)
// just re-runs `npm run build` in apps/web; the new files are live the
// moment the build finishes, no restart/reload required.
module.exports = {
  apps: [
    {
      name: 'athletics-cms',
      cwd: './apps/cms',
      script: './node_modules/.bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
