import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

// payload-deploy:allow-destructive — deliberately reviewed. Adds the new
// SpecialPages collection and drops Links.slug: the short-lived
// Links-based redirect approach (added, then immediately superseded by
// SpecialPages' /go/[slug] pages, which also cover full content — not
// just external redirects). No production data ever used that column.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_special_pages_link_type" AS ENUM('article', 'external', 'pdf');
  CREATE TYPE "public"."enum_special_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__special_pages_v_version_link_type" AS ENUM('article', 'external', 'pdf');
  CREATE TYPE "public"."enum__special_pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "special_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"excerpt" varchar,
  	"link_type" "enum_special_pages_link_type" DEFAULT 'article',
  	"body" jsonb,
  	"external_url" varchar,
  	"pdf_file_id" integer,
  	"hero_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_special_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_special_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_excerpt" varchar,
  	"version_link_type" "enum__special_pages_v_version_link_type" DEFAULT 'article',
  	"version_body" jsonb,
  	"version_external_url" varchar,
  	"version_pdf_file_id" integer,
  	"version_hero_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__special_pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  DROP INDEX "links_slug_idx";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "special_pages_id" integer;
  ALTER TABLE "special_pages" ADD CONSTRAINT "special_pages_pdf_file_id_media_id_fk" FOREIGN KEY ("pdf_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "special_pages" ADD CONSTRAINT "special_pages_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_special_pages_v" ADD CONSTRAINT "_special_pages_v_parent_id_special_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."special_pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_special_pages_v" ADD CONSTRAINT "_special_pages_v_version_pdf_file_id_media_id_fk" FOREIGN KEY ("version_pdf_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_special_pages_v" ADD CONSTRAINT "_special_pages_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "special_pages_slug_idx" ON "special_pages" USING btree ("slug");
  CREATE INDEX "special_pages_pdf_file_idx" ON "special_pages" USING btree ("pdf_file_id");
  CREATE INDEX "special_pages_hero_image_idx" ON "special_pages" USING btree ("hero_image_id");
  CREATE INDEX "special_pages_updated_at_idx" ON "special_pages" USING btree ("updated_at");
  CREATE INDEX "special_pages_created_at_idx" ON "special_pages" USING btree ("created_at");
  CREATE INDEX "special_pages__status_idx" ON "special_pages" USING btree ("_status");
  CREATE INDEX "_special_pages_v_parent_idx" ON "_special_pages_v" USING btree ("parent_id");
  CREATE INDEX "_special_pages_v_version_version_slug_idx" ON "_special_pages_v" USING btree ("version_slug");
  CREATE INDEX "_special_pages_v_version_version_pdf_file_idx" ON "_special_pages_v" USING btree ("version_pdf_file_id");
  CREATE INDEX "_special_pages_v_version_version_hero_image_idx" ON "_special_pages_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_special_pages_v_version_version_updated_at_idx" ON "_special_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_special_pages_v_version_version_created_at_idx" ON "_special_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_special_pages_v_version_version__status_idx" ON "_special_pages_v" USING btree ("version__status");
  CREATE INDEX "_special_pages_v_created_at_idx" ON "_special_pages_v" USING btree ("created_at");
  CREATE INDEX "_special_pages_v_updated_at_idx" ON "_special_pages_v" USING btree ("updated_at");
  CREATE INDEX "_special_pages_v_latest_idx" ON "_special_pages_v" USING btree ("latest");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_special_pages_fk" FOREIGN KEY ("special_pages_id") REFERENCES "public"."special_pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_special_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("special_pages_id");
  ALTER TABLE "links" DROP COLUMN "slug";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "special_pages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_special_pages_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "special_pages" CASCADE;
  DROP TABLE "_special_pages_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_special_pages_fk";
  
  DROP INDEX "payload_locked_documents_rels_special_pages_id_idx";
  ALTER TABLE "links" ADD COLUMN "slug" varchar;
  CREATE UNIQUE INDEX "links_slug_idx" ON "links" USING btree ("slug");
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "special_pages_id";
  DROP TYPE "public"."enum_special_pages_link_type";
  DROP TYPE "public"."enum_special_pages_status";
  DROP TYPE "public"."enum__special_pages_v_version_link_type";
  DROP TYPE "public"."enum__special_pages_v_version_status";`)
}
