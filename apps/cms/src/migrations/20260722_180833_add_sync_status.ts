import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "sync_status" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"last_sync_at" timestamp(3) with time zone,
  	"created" numeric,
  	"updated" numeric,
  	"retired" numeric,
  	"skipped" numeric,
  	"warnings" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "sync_status" CASCADE;`)
}
