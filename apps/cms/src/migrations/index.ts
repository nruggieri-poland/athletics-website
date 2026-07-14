import * as migration_20260710_154727_initial_schema from './20260710_154727_initial_schema';
import * as migration_20260714_040659_add_media_folders from './20260714_040659_add_media_folders';

export const migrations = [
  {
    up: migration_20260710_154727_initial_schema.up,
    down: migration_20260710_154727_initial_schema.down,
    name: '20260710_154727_initial_schema',
  },
  {
    up: migration_20260714_040659_add_media_folders.up,
    down: migration_20260714_040659_add_media_folders.down,
    name: '20260714_040659_add_media_folders'
  },
];
