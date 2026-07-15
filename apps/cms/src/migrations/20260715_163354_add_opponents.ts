import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "opponents_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"alias" varchar NOT NULL
  );
  
  CREATE TABLE "opponents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"mascot" varchar,
  	"logo_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "opponents_id" integer;
  ALTER TABLE "opponents_aliases" ADD CONSTRAINT "opponents_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."opponents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "opponents" ADD CONSTRAINT "opponents_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "opponents_aliases_order_idx" ON "opponents_aliases" USING btree ("_order");
  CREATE INDEX "opponents_aliases_parent_id_idx" ON "opponents_aliases" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "opponents_name_idx" ON "opponents" USING btree ("name");
  CREATE INDEX "opponents_logo_idx" ON "opponents" USING btree ("logo_id");
  CREATE INDEX "opponents_updated_at_idx" ON "opponents" USING btree ("updated_at");
  CREATE INDEX "opponents_created_at_idx" ON "opponents" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opponents_fk" FOREIGN KEY ("opponents_id") REFERENCES "public"."opponents"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_opponents_id_idx" ON "payload_locked_documents_rels" USING btree ("opponents_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "opponents_aliases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "opponents" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "opponents_aliases" CASCADE;
  DROP TABLE "opponents" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_opponents_fk";
  
  DROP INDEX "payload_locked_documents_rels_opponents_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "opponents_id";`)
}
