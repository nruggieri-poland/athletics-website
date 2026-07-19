import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

// payload-deploy:allow-destructive — deliberately reviewed. up() drops only
// the payload_folders_folder_type table and its enum: obsolete per-collection
// folder-scoping metadata that the app stopped reading when payload.config.ts
// set folders.collectionSpecific: false. Zero content data lives there. This
// marker tells scripts/deploy.sh's destructive-migration guard to let this
// specific file through; any migration WITHOUT this marker that contains a
// DROP in its up() is still refused and requires human review.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload_folders_folder_type" CASCADE;
  DROP TYPE "public"."enum_payload_folders_folder_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_payload_folders_folder_type" AS ENUM('media', 'documents');
  CREATE TABLE "payload_folders_folder_type" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_payload_folders_folder_type",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "payload_folders_folder_type" ADD CONSTRAINT "payload_folders_folder_type_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_folders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_folders_folder_type_order_idx" ON "payload_folders_folder_type" USING btree ("order");
  CREATE INDEX "payload_folders_folder_type_parent_idx" ON "payload_folders_folder_type" USING btree ("parent_id");`)
}
