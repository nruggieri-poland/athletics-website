import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_games_result" ADD VALUE '1st';
  ALTER TYPE "public"."enum_games_result" ADD VALUE '2nd';
  ALTER TYPE "public"."enum_games_result" ADD VALUE '3rd';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "games" ALTER COLUMN "result" SET DATA TYPE text;
  DROP TYPE "public"."enum_games_result";
  CREATE TYPE "public"."enum_games_result" AS ENUM('W', 'L', 'T');
  ALTER TABLE "games" ALTER COLUMN "result" SET DATA TYPE "public"."enum_games_result" USING "result"::"public"."enum_games_result";`)
}
