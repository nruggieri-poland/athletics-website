import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

// payload-deploy:allow-destructive — deliberately reviewed. Documents is
// retired entirely: its role splits between Media (uploaded files, now
// taggable/publicly-listable itself — see the "Public Resource Details"
// group added earlier) and Links (URL/video-only resources). Only 6 real
// Documents exist in production as of this migration; they get manually
// re-entered as tagged Media/Links items after this deploys — same
// low-risk pattern already used once before for this exact collection.
// Tags.type is dropped as part of making tags fully open: every taggable
// collection now points at Tags through the same `tags` field with no
// type-based filtering, so the column has no remaining purpose. Dropping
// it loses no tag names, slugs, or relationships — only the now-unused
// audience/topic classification itself.
//
// One line removed from what the generator produced: an explicit
// `ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT
// payload_locked_documents_rels_documents_fk` — `DROP TABLE documents
// CASCADE` already removes that same constraint as a side effect
// (confirmed against a real Postgres instance; the generated statement
// failed with "constraint ... does not exist" when run in order after the
// cascade already took it). The index and column drops for
// payload_locked_documents_rels.documents_id still run as generated —
// only the constraint itself was already gone.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "documents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "documents_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "documents" CASCADE;
  DROP TABLE "documents_rels" CASCADE;
  DROP INDEX "payload_locked_documents_rels_documents_id_idx";
  ALTER TABLE "tags" DROP COLUMN "type";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "documents_id";
  DROP TYPE "public"."enum_documents_audience";
  DROP TYPE "public"."enum_documents_file_type";
  DROP TYPE "public"."enum_tags_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_documents_audience" AS ENUM('coaches', 'parents', 'both');
  CREATE TYPE "public"."enum_documents_file_type" AS ENUM('upload', 'link');
  CREATE TYPE "public"."enum_tags_type" AS ENUM('audience', 'topic');
  CREATE TABLE "documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"audience" "enum_documents_audience" DEFAULT 'both' NOT NULL,
  	"is_public" boolean DEFAULT false,
  	"file_type" "enum_documents_file_type" DEFAULT 'upload' NOT NULL,
  	"file_id" integer,
  	"external_url" varchar,
  	"description" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"folder_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer
  );
  
  ALTER TABLE "tags" ADD COLUMN "type" "enum_tags_type" NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "documents_id" integer;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_payload_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents_rels" ADD CONSTRAINT "documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_rels" ADD CONSTRAINT "documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "documents_file_idx" ON "documents" USING btree ("file_id");
  CREATE INDEX "documents_folder_idx" ON "documents" USING btree ("folder_id");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE INDEX "documents_rels_order_idx" ON "documents_rels" USING btree ("order");
  CREATE INDEX "documents_rels_parent_idx" ON "documents_rels" USING btree ("parent_id");
  CREATE INDEX "documents_rels_path_idx" ON "documents_rels" USING btree ("path");
  CREATE INDEX "documents_rels_tags_id_idx" ON "documents_rels" USING btree ("tags_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");`)
}
