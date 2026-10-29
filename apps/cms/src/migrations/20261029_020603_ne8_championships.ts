import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ne8_championships_title" AS ENUM('champions', 'co-champions', 'tournament-champions');
  CREATE TYPE "public"."enum_ne8_championships_division" AS ENUM('Boys', 'Girls');
  CREATE TABLE "ne8_championships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"sport_id" integer NOT NULL,
  	"school_year" varchar NOT NULL,
  	"title" "enum_ne8_championships_title" DEFAULT 'champions' NOT NULL,
  	"division" "enum_ne8_championships_division",
  	"record" varchar,
  	"team_photo_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ne8_championships_id" integer;
  ALTER TABLE "ne8_championships" ADD CONSTRAINT "ne8_championships_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ne8_championships" ADD CONSTRAINT "ne8_championships_team_photo_id_media_id_fk" FOREIGN KEY ("team_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "ne8_championships_sport_idx" ON "ne8_championships" USING btree ("sport_id");
  CREATE INDEX "ne8_championships_school_year_idx" ON "ne8_championships" USING btree ("school_year");
  CREATE INDEX "ne8_championships_team_photo_idx" ON "ne8_championships" USING btree ("team_photo_id");
  CREATE INDEX "ne8_championships_updated_at_idx" ON "ne8_championships" USING btree ("updated_at");
  CREATE INDEX "ne8_championships_created_at_idx" ON "ne8_championships" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ne8_championships_fk" FOREIGN KEY ("ne8_championships_id") REFERENCES "public"."ne8_championships"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_ne8_championships_id_idx" ON "payload_locked_documents_rels" USING btree ("ne8_championships_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "ne8_championships" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ne8_championships" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ne8_championships_fk";
  
  DROP INDEX "payload_locked_documents_rels_ne8_championships_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ne8_championships_id";
  DROP TYPE "public"."enum_ne8_championships_title";
  DROP TYPE "public"."enum_ne8_championships_division";`)
}
