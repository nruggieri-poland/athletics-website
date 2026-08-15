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
import { Tags } from './collections/Tags.ts'
import { Links } from './collections/Links.ts'
import { Galleries } from './collections/Galleries.ts'
import { SiteSettings } from './globals/SiteSettings.ts'
import { Navigation } from './globals/Navigation.ts'
import { SyncStatus } from './globals/SyncStatus.ts'
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

// A missing secret must fail loudly at startup, not silently sign every
// auth cookie/token with an empty (forgeable) string — the `|| ''`
// fallback this replaced would have done exactly that.
if (!process.env.PAYLOAD_SECRET) {
  throw new Error('PAYLOAD_SECRET environment variable is not set.')
}

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET,
  csrf: csrfOrigins,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  editor: lexicalEditor(),
  collections: [Users, Media, Sports, Seasons, Teams, Games, Opponents, Articles, Tags, Links, Galleries],
  globals: [SiteSettings, Navigation, SyncStatus],
  // Public read access on the auto-generated payload-folders collection —
  // without this, folder names never populate on public REST reads (a
  // Media item's `folder` relation would come back as a bare numeric ID
  // instead of `{ id, name }`).
  //
  // collectionSpecific: false — its original purpose (sharing one folder
  // tree between Documents and Media) is gone now that Documents is gone
  // too, but this must stay `false` regardless: the default (`true`) adds
  // back a `folderType` field/enum on the folders collection, which is
  // exactly what an earlier migration deliberately dropped as unused
  // (20260718_021527_drop_unused_folder_type_scoping) — reverting to the
  // default would resurrect it for no benefit with only one collection.
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
