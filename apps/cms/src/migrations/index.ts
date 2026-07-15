import * as migration_20260710_154727_initial_schema from './20260710_154727_initial_schema';
import * as migration_20260714_040659_add_media_folders from './20260714_040659_add_media_folders';
import * as migration_20260715_163354_add_opponents from './20260715_163354_add_opponents';

export const migrations = [
  {
    up: migration_20260710_154727_initial_schema.up,
    down: migration_20260710_154727_initial_schema.down,
    name: '20260710_154727_initial_schema',
  },
  {
    up: migration_20260714_040659_add_media_folders.up,
    down: migration_20260714_040659_add_media_folders.down,
    name: '20260714_040659_add_media_folders',
  },
  {
    up: migration_20260715_163354_add_opponents.up,
    down: migration_20260715_163354_add_opponents.down,
    name: '20260715_163354_add_opponents'
  },
];
