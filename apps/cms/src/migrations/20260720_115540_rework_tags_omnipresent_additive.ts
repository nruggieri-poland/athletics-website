import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "galleries_rels" ADD COLUMN "tags_id" integer;
  ALTER TABLE "galleries_rels" ADD CONSTRAINT "galleries_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "galleries_rels_tags_id_idx" ON "galleries_rels" USING btree ("tags_id");

  -- Articles.topicTags is renamed to Articles.tags (see lib/fields/tagsField.ts).
  -- Payload/Postgres store a hasMany relationship's rows in the parent
  -- collection's shared *_rels table, discriminated by a free-text "path"
  -- column — not a dedicated column per field name — so this rename is a
  -- pure data update, not a schema change. The "tags_id" foreign-key column
  -- these rows use already exists (added when topicTags was created).
  UPDATE "articles_rels" SET "path" = 'tags' WHERE "path" = 'topicTags';
  UPDATE "_articles_v_rels" SET "path" = 'tags' WHERE "path" = 'topicTags';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "articles_rels" SET "path" = 'topicTags' WHERE "path" = 'tags' AND "tags_id" IS NOT NULL;
  UPDATE "_articles_v_rels" SET "path" = 'topicTags' WHERE "path" = 'tags' AND "tags_id" IS NOT NULL;

  ALTER TABLE "galleries_rels" DROP CONSTRAINT "galleries_rels_tags_fk";

  DROP INDEX "galleries_rels_tags_id_idx";
  ALTER TABLE "galleries_rels" DROP COLUMN "tags_id";`)
}
