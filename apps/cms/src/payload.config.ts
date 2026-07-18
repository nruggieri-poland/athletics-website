import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

import { Users } from './collections/Users.ts'
import { Media } from './collections/Media.ts'
import { Sports } from './collections/Sports.ts'
import { Seasons } from './collections/Seasons.ts'
import { Teams } from './collections/Teams.ts'
import { Games } from './collections/Games.ts'
import { Opponents } from './collections/Opponents.ts'
import { Articles } from './collections/Articles.ts'
import { Documents } from './collections/Documents.ts'
import { Tags } from './collections/Tags.ts'
import { SiteSettings } from './globals/SiteSettings.ts'
import { Navigation } from './globals/Navigation.ts'
import { importFeedHandler } from './endpoints/importFeed.ts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Payload only enforces its own cross-origin cookie-auth check against
// origins listed here — leaving this unset (the default) makes it accept
// the auth cookie regardless of the request's Origin header, relying
// entirely on the browser's own SameSite cookie default as the only
// remaining defense against a malicious site making authenticated
// state-changing requests using an admin's active session. Comma-separated
// if the admin is ever reachable from more than one origin.
const csrfOrigins = (process.env.CSRF_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || '',
  csrf: csrfOrigins,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  editor: lexicalEditor(),
  collections: [Users, Media, Sports, Seasons, Teams, Games, Opponents, Articles, Documents, Tags],
  globals: [SiteSettings, Navigation],
  // Public read access on the auto-generated payload-folders collection —
  // without this, folder names never populate on public REST reads (the
  // Documents collection's `folder` relation comes back as a bare numeric
  // ID instead of `{ id, name }`), which silently breaks folder display on
  // the /documents pages (everything falls back to "General").
  //
  // collectionSpecific: false — Documents and Media both have folders:
  // true, but by default each folder is scoped to the collection it was
  // created from (a `folderType` field), so a folder made while browsing
  // Documents never shows Media files and vice versa. Turning this off
  // removes that scoping entirely, so one shared folder tree can hold both
  // — no migration needed, this is a pure admin-behavior config flag.
  folders: {
    collectionSpecific: false,
    collectionOverrides: [
      ({ collection }) => ({
        ...collection,
        access: {
          ...collection.access,
          read: () => true,
        },
      }),
    ],
  },
  endpoints: [
    {
      path: '/import-feed',
      method: 'post',
      handler: importFeedHandler,
    },
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, '../../../packages/shared-types/src/payload-types.ts'),
  },
})
