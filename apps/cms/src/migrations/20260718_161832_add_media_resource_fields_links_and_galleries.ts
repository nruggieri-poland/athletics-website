import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_links_link_type" AS ENUM('external', 'video');
  CREATE TABLE "media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer
  );
  
  CREATE TABLE "links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"link_type" "enum_links_link_type" DEFAULT 'external' NOT NULL,
  	"url" varchar,
  	"video_id" varchar,
  	"description" varchar,
  	"is_public" boolean DEFAULT false,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "links_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer
  );
  
  CREATE TABLE "galleries_sections_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"caption" varchar
  );
  
  CREATE TABLE "galleries_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar
  );
  
  CREATE TABLE "galleries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"is_public" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "galleries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"links_id" integer
  );
  
  ALTER TABLE "media" ADD COLUMN "title" varchar;
  ALTER TABLE "media" ADD COLUMN "description" varchar;
  ALTER TABLE "media" ADD COLUMN "sort_order" numeric DEFAULT 0;
  ALTER TABLE "media" ADD COLUMN "is_public" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "links_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "galleries_id" integer;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "links_rels" ADD CONSTRAINT "links_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "links_rels" ADD CONSTRAINT "links_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "galleries_sections_items" ADD CONSTRAINT "galleries_sections_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."galleries_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "galleries_sections" ADD CONSTRAINT "galleries_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "galleries_rels" ADD CONSTRAINT "galleries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "galleries_rels" ADD CONSTRAINT "galleries_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "galleries_rels" ADD CONSTRAINT "galleries_rels_links_fk" FOREIGN KEY ("links_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_rels_order_idx" ON "media_rels" USING btree ("order");
  CREATE INDEX "media_rels_parent_idx" ON "media_rels" USING btree ("parent_id");
  CREATE INDEX "media_rels_path_idx" ON "media_rels" USING btree ("path");
  CREATE INDEX "media_rels_tags_id_idx" ON "media_rels" USING btree ("tags_id");
  CREATE INDEX "links_updated_at_idx" ON "links" USING btree ("updated_at");
  CREATE INDEX "links_created_at_idx" ON "links" USING btree ("created_at");
  CREATE INDEX "links_rels_order_idx" ON "links_rels" USING btree ("order");
  CREATE INDEX "links_rels_parent_idx" ON "links_rels" USING btree ("parent_id");
  CREATE INDEX "links_rels_path_idx" ON "links_rels" USING btree ("path");
  CREATE INDEX "links_rels_tags_id_idx" ON "links_rels" USING btree ("tags_id");
  CREATE INDEX "galleries_sections_items_order_idx" ON "galleries_sections_items" USING btree ("_order");
  CREATE INDEX "galleries_sections_items_parent_id_idx" ON "galleries_sections_items" USING btree ("_parent_id");
  CREATE INDEX "galleries_sections_order_idx" ON "galleries_sections" USING btree ("_order");
  CREATE INDEX "galleries_sections_parent_id_idx" ON "galleries_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "galleries_slug_idx" ON "galleries" USING btree ("slug");
  CREATE INDEX "galleries_updated_at_idx" ON "galleries" USING btree ("updated_at");
  CREATE INDEX "galleries_created_at_idx" ON "galleries" USING btree ("created_at");
  CREATE INDEX "galleries_rels_order_idx" ON "galleries_rels" USING btree ("order");
  CREATE INDEX "galleries_rels_parent_idx" ON "galleries_rels" USING btree ("parent_id");
  CREATE INDEX "galleries_rels_path_idx" ON "galleries_rels" USING btree ("path");
  CREATE INDEX "galleries_rels_media_id_idx" ON "galleries_rels" USING btree ("media_id");
  CREATE INDEX "galleries_rels_links_id_idx" ON "galleries_rels" USING btree ("links_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_links_fk" FOREIGN KEY ("links_id") REFERENCES "public"."links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_galleries_fk" FOREIGN KEY ("galleries_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_links_id_idx" ON "payload_locked_documents_rels" USING btree ("links_id");
  CREATE INDEX "payload_locked_documents_rels_galleries_id_idx" ON "payload_locked_documents_rels" USING btree ("galleries_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "links_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "galleries_sections_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "galleries_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "galleries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "galleries_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "media_rels" CASCADE;
  DROP TABLE "links" CASCADE;
  DROP TABLE "links_rels" CASCADE;
  DROP TABLE "galleries_sections_items" CASCADE;
  DROP TABLE "galleries_sections" CASCADE;
  DROP TABLE "galleries" CASCADE;
  DROP TABLE "galleries_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_links_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_galleries_fk";
  
  DROP INDEX "payload_locked_documents_rels_links_id_idx";
  DROP INDEX "payload_locked_documents_rels_galleries_id_idx";
  ALTER TABLE "media" DROP COLUMN "title";
  ALTER TABLE "media" DROP COLUMN "description";
  ALTER TABLE "media" DROP COLUMN "sort_order";
  ALTER TABLE "media" DROP COLUMN "is_public";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "links_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "galleries_id";
  DROP TYPE "public"."enum_links_link_type";`)
}
