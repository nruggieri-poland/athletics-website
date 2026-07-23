import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_placement" AS ENUM('none', 'boosterProgramAds', 'boosterSponsorships');
  ALTER TABLE "media" ADD COLUMN "placement" "enum_media_placement" DEFAULT 'none';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP COLUMN "placement";
  DROP TYPE "public"."enum_media_placement";`)
}
