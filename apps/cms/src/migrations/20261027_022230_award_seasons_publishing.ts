import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_award_seasons_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__award_seasons_v_version_awards_honor" AS ENUM('player-of-the-year', 'coach-of-the-year', 'first-team', 'second-team', 'honorable-mention');
  CREATE TYPE "public"."enum__award_seasons_v_version_awards_grade" AS ENUM('Freshman', 'Sophomore', 'Junior', 'Senior');
  CREATE TYPE "public"."enum__award_seasons_v_version_awards_division" AS ENUM('Boys', 'Girls');
  CREATE TYPE "public"."enum__award_seasons_v_version_season" AS ENUM('Fall', 'Winter', 'Spring');
  CREATE TYPE "public"."enum__award_seasons_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "_award_seasons_v_version_awards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"athlete_name" varchar,
  	"honor" "enum__award_seasons_v_version_awards_honor" DEFAULT 'first-team',
  	"grade" "enum__award_seasons_v_version_awards_grade",
  	"sport_id" integer,
  	"division" "enum__award_seasons_v_version_awards_division",
  	"honor_title" varchar,
  	"photo_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_award_seasons_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_school_year" varchar,
  	"version_season" "enum__award_seasons_v_version_season",
  	"version_slug" varchar,
  	"version_intro" varchar,
  	"version_cover_image_id" integer,
  	"version_gallery_url" varchar,
  	"version_paste_list" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__award_seasons_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_award_seasons_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"award_photos_id" integer
  );
  
  ALTER TABLE "award_seasons_awards" ALTER COLUMN "athlete_name" DROP NOT NULL;
  ALTER TABLE "award_seasons_awards" ALTER COLUMN "honor" DROP NOT NULL;
  ALTER TABLE "award_seasons_awards" ALTER COLUMN "sport_id" DROP NOT NULL;
  ALTER TABLE "award_seasons" ALTER COLUMN "school_year" DROP NOT NULL;
  ALTER TABLE "award_seasons" ALTER COLUMN "season" DROP NOT NULL;
  ALTER TABLE "award_seasons" ADD COLUMN "_status" "enum_award_seasons_status" DEFAULT 'draft';
  ALTER TABLE "_award_seasons_v_version_awards" ADD CONSTRAINT "_award_seasons_v_version_awards_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_award_seasons_v_version_awards" ADD CONSTRAINT "_award_seasons_v_version_awards_photo_id_award_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."award_photos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_award_seasons_v_version_awards" ADD CONSTRAINT "_award_seasons_v_version_awards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_award_seasons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_award_seasons_v" ADD CONSTRAINT "_award_seasons_v_parent_id_award_seasons_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."award_seasons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_award_seasons_v" ADD CONSTRAINT "_award_seasons_v_version_cover_image_id_award_photos_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."award_photos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_award_seasons_v_rels" ADD CONSTRAINT "_award_seasons_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_award_seasons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_award_seasons_v_rels" ADD CONSTRAINT "_award_seasons_v_rels_award_photos_fk" FOREIGN KEY ("award_photos_id") REFERENCES "public"."award_photos"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "_award_seasons_v_version_awards_order_idx" ON "_award_seasons_v_version_awards" USING btree ("_order");
  CREATE INDEX "_award_seasons_v_version_awards_parent_id_idx" ON "_award_seasons_v_version_awards" USING btree ("_parent_id");
  CREATE INDEX "_award_seasons_v_version_awards_sport_idx" ON "_award_seasons_v_version_awards" USING btree ("sport_id");
  CREATE INDEX "_award_seasons_v_version_awards_photo_idx" ON "_award_seasons_v_version_awards" USING btree ("photo_id");
  CREATE INDEX "_award_seasons_v_parent_idx" ON "_award_seasons_v" USING btree ("parent_id");
  CREATE INDEX "_award_seasons_v_version_version_slug_idx" ON "_award_seasons_v" USING btree ("version_slug");
  CREATE INDEX "_award_seasons_v_version_version_cover_image_idx" ON "_award_seasons_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_award_seasons_v_version_version_updated_at_idx" ON "_award_seasons_v" USING btree ("version_updated_at");
  CREATE INDEX "_award_seasons_v_version_version_created_at_idx" ON "_award_seasons_v" USING btree ("version_created_at");
  CREATE INDEX "_award_seasons_v_version_version__status_idx" ON "_award_seasons_v" USING btree ("version__status");
  CREATE INDEX "_award_seasons_v_created_at_idx" ON "_award_seasons_v" USING btree ("created_at");
  CREATE INDEX "_award_seasons_v_updated_at_idx" ON "_award_seasons_v" USING btree ("updated_at");
  CREATE INDEX "_award_seasons_v_latest_idx" ON "_award_seasons_v" USING btree ("latest");
  CREATE INDEX "_award_seasons_v_rels_order_idx" ON "_award_seasons_v_rels" USING btree ("order");
  CREATE INDEX "_award_seasons_v_rels_parent_idx" ON "_award_seasons_v_rels" USING btree ("parent_id");
  CREATE INDEX "_award_seasons_v_rels_path_idx" ON "_award_seasons_v_rels" USING btree ("path");
  CREATE INDEX "_award_seasons_v_rels_award_photos_id_idx" ON "_award_seasons_v_rels" USING btree ("award_photos_id");
  CREATE INDEX "award_seasons__status_idx" ON "award_seasons" USING btree ("_status");
  -- Hand-added: every season that was "Visible on the live site" becomes
  -- Published, so switching to Publish/Unpublish takes nothing off the site.
  UPDATE "award_seasons" SET "_status" = CASE WHEN "is_public" THEN 'published'::"enum_award_seasons_status" ELSE 'draft'::"enum_award_seasons_status" END;
  ALTER TABLE "award_seasons" DROP COLUMN "is_public";`)

  // Hand-added: with drafts on, the admin's list and edit views read each
  // season from its versions — a season saved before this migration has
  // none yet, so without this it would silently drop out of the admin
  // (while still showing on the site). One version per existing season,
  // carrying its current content and status.
  const { docs } = await payload.find({
    collection: 'award-seasons',
    depth: 0,
    limit: 0,
    pagination: false,
    req,
  })
  for (const doc of docs) {
    await payload.db.createVersion({
      autosave: false,
      collectionSlug: 'award-seasons',
      createdAt: doc.createdAt,
      parent: doc.id,
      req,
      updatedAt: doc.updatedAt,
      versionData: doc,
    })
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_award_seasons_v_version_awards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_award_seasons_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_award_seasons_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "_award_seasons_v_version_awards" CASCADE;
  DROP TABLE "_award_seasons_v" CASCADE;
  DROP TABLE "_award_seasons_v_rels" CASCADE;
  DROP INDEX "award_seasons__status_idx";
  ALTER TABLE "award_seasons_awards" ALTER COLUMN "athlete_name" SET NOT NULL;
  ALTER TABLE "award_seasons_awards" ALTER COLUMN "honor" SET NOT NULL;
  ALTER TABLE "award_seasons_awards" ALTER COLUMN "sport_id" SET NOT NULL;
  ALTER TABLE "award_seasons" ALTER COLUMN "school_year" SET NOT NULL;
  ALTER TABLE "award_seasons" ALTER COLUMN "season" SET NOT NULL;
  ALTER TABLE "award_seasons" ADD COLUMN "is_public" boolean DEFAULT false;
  -- Hand-added: the reverse of the up migration's status copy.
  UPDATE "award_seasons" SET "is_public" = ("_status" = 'published');
  ALTER TABLE "award_seasons" DROP COLUMN "_status";
  DROP TYPE "public"."enum_award_seasons_status";
  DROP TYPE "public"."enum__award_seasons_v_version_awards_honor";
  DROP TYPE "public"."enum__award_seasons_v_version_awards_grade";
  DROP TYPE "public"."enum__award_seasons_v_version_awards_division";
  DROP TYPE "public"."enum__award_seasons_v_version_season";
  DROP TYPE "public"."enum__award_seasons_v_version_status";`)
}
