import * as migration_20260710_154727_initial_schema from './20260710_154727_initial_schema';
import * as migration_20260714_040659_add_media_folders from './20260714_040659_add_media_folders';
import * as migration_20260715_163354_add_opponents from './20260715_163354_add_opponents';
import * as migration_20260718_015256_add_tags_and_document_topic_tags from './20260718_015256_add_tags_and_document_topic_tags';
import * as migration_20260718_021527_drop_unused_folder_type_scoping from './20260718_021527_drop_unused_folder_type_scoping';
import * as migration_20260718_161832_add_media_resource_fields_links_and_galleries from './20260718_161832_add_media_resource_fields_links_and_galleries';

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
    name: '20260715_163354_add_opponents',
  },
  {
    up: migration_20260718_015256_add_tags_and_document_topic_tags.up,
    down: migration_20260718_015256_add_tags_and_document_topic_tags.down,
    name: '20260718_015256_add_tags_and_document_topic_tags',
  },
  {
    up: migration_20260718_021527_drop_unused_folder_type_scoping.up,
    down: migration_20260718_021527_drop_unused_folder_type_scoping.down,
    name: '20260718_021527_drop_unused_folder_type_scoping',
  },
  {
    up: migration_20260718_161832_add_media_resource_fields_links_and_galleries.up,
    down: migration_20260718_161832_add_media_resource_fields_links_and_galleries.down,
    name: '20260718_161832_add_media_resource_fields_links_and_galleries'
  },
];
