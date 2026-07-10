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
import { Articles } from './collections/Articles.ts'
import { Documents } from './collections/Documents.ts'
import { SiteSettings } from './globals/SiteSettings.ts'
import { Navigation } from './globals/Navigation.ts'
import { importFeedHandler } from './endpoints/importFeed.ts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || '',
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  editor: lexicalEditor(),
  collections: [Users, Media, Sports, Seasons, Teams, Games, Articles, Documents],
  globals: [SiteSettings, Navigation],
  // Public read access on the auto-generated payload-folders collection —
  // without this, folder names never populate on public REST reads (the
  // Documents collection's `folder` relation comes back as a bare numeric
  // ID instead of `{ id, name }`), which silently breaks folder display on
  // the /documents pages (everything falls back to "General").
  folders: {
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
