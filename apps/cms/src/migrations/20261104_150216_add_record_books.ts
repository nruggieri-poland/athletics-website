import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_record_books_categories_entries_status" AS ENUM('original', 'broken', 'tied');
  CREATE TYPE "public"."enum_record_books_categories_better_when" AS ENUM('none', 'lower', 'higher');
  CREATE TYPE "public"."enum_record_books_division" AS ENUM('Boys', 'Girls');
  CREATE TABLE "record_books_categories_entries_holders" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"class_of" numeric
  );
  
  CREATE TABLE "record_books_categories_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"status" "enum_record_books_categories_entries_status" DEFAULT 'broken' NOT NULL,
  	"mark" varchar NOT NULL,
  	"date" varchar NOT NULL,
  	"notes" varchar
  );
  
  CREATE TABLE "record_books_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"better_when" "enum_record_books_categories_better_when" DEFAULT 'none'
  );
  
  CREATE TABLE "record_books" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"sport_id" integer NOT NULL,
  	"division" "enum_record_books_division",
  	"is_public" boolean DEFAULT false,
  	"current_records" jsonb,
  	"paste_list" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "record_books_id" integer;
  ALTER TABLE "record_books_categories_entries_holders" ADD CONSTRAINT "record_books_categories_entries_holders_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."record_books_categories_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "record_books_categories_entries" ADD CONSTRAINT "record_books_categories_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."record_books_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "record_books_categories" ADD CONSTRAINT "record_books_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."record_books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "record_books" ADD CONSTRAINT "record_books_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "record_books_categories_entries_holders_order_idx" ON "record_books_categories_entries_holders" USING btree ("_order");
  CREATE INDEX "record_books_categories_entries_holders_parent_id_idx" ON "record_books_categories_entries_holders" USING btree ("_parent_id");
  CREATE INDEX "record_books_categories_entries_order_idx" ON "record_books_categories_entries" USING btree ("_order");
  CREATE INDEX "record_books_categories_entries_parent_id_idx" ON "record_books_categories_entries" USING btree ("_parent_id");
  CREATE INDEX "record_books_categories_order_idx" ON "record_books_categories" USING btree ("_order");
  CREATE INDEX "record_books_categories_parent_id_idx" ON "record_books_categories" USING btree ("_parent_id");
  CREATE INDEX "record_books_name_idx" ON "record_books" USING btree ("name");
  CREATE INDEX "record_books_sport_idx" ON "record_books" USING btree ("sport_id");
  CREATE INDEX "record_books_is_public_idx" ON "record_books" USING btree ("is_public");
  CREATE INDEX "record_books_updated_at_idx" ON "record_books" USING btree ("updated_at");
  CREATE INDEX "record_books_created_at_idx" ON "record_books" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_record_books_fk" FOREIGN KEY ("record_books_id") REFERENCES "public"."record_books"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_record_books_id_idx" ON "payload_locked_documents_rels" USING btree ("record_books_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "record_books_categories_entries_holders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "record_books_categories_entries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "record_books_categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "record_books" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "record_books_categories_entries_holders" CASCADE;
  DROP TABLE "record_books_categories_entries" CASCADE;
  DROP TABLE "record_books_categories" CASCADE;
  DROP TABLE "record_books" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_record_books_fk";
  
  DROP INDEX "payload_locked_documents_rels_record_books_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "record_books_id";
  DROP TYPE "public"."enum_record_books_categories_entries_status";
  DROP TYPE "public"."enum_record_books_categories_better_when";
  DROP TYPE "public"."enum_record_books_division";`)
}
