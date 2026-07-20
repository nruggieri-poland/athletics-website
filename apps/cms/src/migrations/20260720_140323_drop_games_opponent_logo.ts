import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

// payload-deploy:allow-destructive — deliberately reviewed. Games.opponentLogo
// is retired: it was a write-time cache of Opponents.logo, kept in sync by
// hooks that are being removed in this same change (see collections/Games.ts
// and collections/Opponents.ts). The frontend now resolves each game's logo
// live by matching opponentName against Opponents at build time, so this
// column has no remaining reader. Dropping it loses no logo data — every
// logo itself lives on Opponents.logo, untouched by this migration.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "games" DROP CONSTRAINT "games_opponent_logo_id_media_id_fk";
  
  DROP INDEX "games_opponent_logo_idx";
  ALTER TABLE "games" DROP COLUMN "opponent_logo_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "games" ADD COLUMN "opponent_logo_id" integer;
  ALTER TABLE "games" ADD CONSTRAINT "games_opponent_logo_id_media_id_fk" FOREIGN KEY ("opponent_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "games_opponent_logo_idx" ON "games" USING btree ("opponent_logo_id");`)
}
