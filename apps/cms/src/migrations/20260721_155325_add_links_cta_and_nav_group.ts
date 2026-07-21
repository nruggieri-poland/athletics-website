import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_links_placement" AS ENUM('none', 'photos', 'watchLive');
  CREATE TYPE "public"."enum_navigation_links_group" AS ENUM('primary', 'more');
  ALTER TABLE "links" ADD COLUMN "logo_id" integer;
  ALTER TABLE "links" ADD COLUMN "cta_label" varchar;
  ALTER TABLE "links" ADD COLUMN "placement" "enum_links_placement" DEFAULT 'none';
  ALTER TABLE "navigation_links" ADD COLUMN "group" "enum_navigation_links_group" DEFAULT 'primary';
  ALTER TABLE "links" ADD CONSTRAINT "links_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "links_logo_idx" ON "links" USING btree ("logo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "links" DROP CONSTRAINT "links_logo_id_media_id_fk";
  
  DROP INDEX "links_logo_idx";
  ALTER TABLE "links" DROP COLUMN "logo_id";
  ALTER TABLE "links" DROP COLUMN "cta_label";
  ALTER TABLE "links" DROP COLUMN "placement";
  ALTER TABLE "navigation_links" DROP COLUMN "group";
  DROP TYPE "public"."enum_links_placement";
  DROP TYPE "public"."enum_navigation_links_group";`)
}
