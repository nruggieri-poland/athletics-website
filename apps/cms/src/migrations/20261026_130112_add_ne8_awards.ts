import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_award_seasons_awards_honor" AS ENUM('player-of-the-year', 'coach-of-the-year', 'first-team', 'second-team', 'honorable-mention');
  CREATE TYPE "public"."enum_award_seasons_awards_grade" AS ENUM('Freshman', 'Sophomore', 'Junior', 'Senior');
  CREATE TYPE "public"."enum_award_seasons_awards_division" AS ENUM('Boys', 'Girls');
  CREATE TYPE "public"."enum_award_seasons_season" AS ENUM('Fall', 'Winter', 'Spring');
  CREATE TABLE "award_seasons_awards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"athlete_name" varchar NOT NULL,
  	"honor" "enum_award_seasons_awards_honor" DEFAULT 'first-team' NOT NULL,
  	"grade" "enum_award_seasons_awards_grade",
  	"sport_id" integer NOT NULL,
  	"division" "enum_award_seasons_awards_division",
  	"honor_title" varchar,
  	"photo_id" integer
  );
  
  CREATE TABLE "award_seasons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"school_year" varchar NOT NULL,
  	"season" "enum_award_seasons_season" NOT NULL,
  	"slug" varchar,
  	"is_public" boolean DEFAULT false,
  	"intro" varchar,
  	"cover_image_id" integer,
  	"gallery_url" varchar,
  	"paste_list" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "award_seasons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"award_photos_id" integer
  );
  
  CREATE TABLE "award_photos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "award_seasons_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "award_photos_id" integer;
  ALTER TABLE "award_seasons_awards" ADD CONSTRAINT "award_seasons_awards_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "award_seasons_awards" ADD CONSTRAINT "award_seasons_awards_photo_id_award_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."award_photos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "award_seasons_awards" ADD CONSTRAINT "award_seasons_awards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."award_seasons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "award_seasons" ADD CONSTRAINT "award_seasons_cover_image_id_award_photos_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."award_photos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "award_seasons_rels" ADD CONSTRAINT "award_seasons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."award_seasons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "award_seasons_rels" ADD CONSTRAINT "award_seasons_rels_award_photos_fk" FOREIGN KEY ("award_photos_id") REFERENCES "public"."award_photos"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "award_seasons_awards_order_idx" ON "award_seasons_awards" USING btree ("_order");
  CREATE INDEX "award_seasons_awards_parent_id_idx" ON "award_seasons_awards" USING btree ("_parent_id");
  CREATE INDEX "award_seasons_awards_sport_idx" ON "award_seasons_awards" USING btree ("sport_id");
  CREATE INDEX "award_seasons_awards_photo_idx" ON "award_seasons_awards" USING btree ("photo_id");
  CREATE UNIQUE INDEX "award_seasons_slug_idx" ON "award_seasons" USING btree ("slug");
  CREATE INDEX "award_seasons_cover_image_idx" ON "award_seasons" USING btree ("cover_image_id");
  CREATE INDEX "award_seasons_updated_at_idx" ON "award_seasons" USING btree ("updated_at");
  CREATE INDEX "award_seasons_created_at_idx" ON "award_seasons" USING btree ("created_at");
  CREATE INDEX "award_seasons_rels_order_idx" ON "award_seasons_rels" USING btree ("order");
  CREATE INDEX "award_seasons_rels_parent_idx" ON "award_seasons_rels" USING btree ("parent_id");
  CREATE INDEX "award_seasons_rels_path_idx" ON "award_seasons_rels" USING btree ("path");
  CREATE INDEX "award_seasons_rels_award_photos_id_idx" ON "award_seasons_rels" USING btree ("award_photos_id");
  CREATE INDEX "award_photos_updated_at_idx" ON "award_photos" USING btree ("updated_at");
  CREATE INDEX "award_photos_created_at_idx" ON "award_photos" USING btree ("created_at");
  CREATE UNIQUE INDEX "award_photos_filename_idx" ON "award_photos" USING btree ("filename");
  CREATE INDEX "award_photos_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "award_photos" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "award_photos_sizes_card_sizes_card_filename_idx" ON "award_photos" USING btree ("sizes_card_filename");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_award_seasons_fk" FOREIGN KEY ("award_seasons_id") REFERENCES "public"."award_seasons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_award_photos_fk" FOREIGN KEY ("award_photos_id") REFERENCES "public"."award_photos"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_award_seasons_id_idx" ON "payload_locked_documents_rels" USING btree ("award_seasons_id");
  CREATE INDEX "payload_locked_documents_rels_award_photos_id_idx" ON "payload_locked_documents_rels" USING btree ("award_photos_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "award_seasons_awards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "award_seasons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "award_seasons_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "award_photos" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "award_seasons_awards" CASCADE;
  DROP TABLE "award_seasons" CASCADE;
  DROP TABLE "award_seasons_rels" CASCADE;
  DROP TABLE "award_photos" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_award_seasons_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_award_photos_fk";
  
  DROP INDEX "payload_locked_documents_rels_award_seasons_id_idx";
  DROP INDEX "payload_locked_documents_rels_award_photos_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "award_seasons_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "award_photos_id";
  DROP TYPE "public"."enum_award_seasons_awards_honor";
  DROP TYPE "public"."enum_award_seasons_awards_grade";
  DROP TYPE "public"."enum_award_seasons_awards_division";
  DROP TYPE "public"."enum_award_seasons_season";`)
}
