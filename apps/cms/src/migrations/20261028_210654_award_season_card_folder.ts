import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "award_seasons" ADD COLUMN "card_folder_id" integer;
  ALTER TABLE "_award_seasons_v" ADD COLUMN "version_card_folder_id" integer;
  ALTER TABLE "award_seasons" ADD CONSTRAINT "award_seasons_card_folder_id_payload_folders_id_fk" FOREIGN KEY ("card_folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_award_seasons_v" ADD CONSTRAINT "_award_seasons_v_version_card_folder_id_payload_folders_id_fk" FOREIGN KEY ("version_card_folder_id") REFERENCES "public"."payload_folders"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "award_seasons_card_folder_idx" ON "award_seasons" USING btree ("card_folder_id");
  CREATE INDEX "_award_seasons_v_version_version_card_folder_idx" ON "_award_seasons_v" USING btree ("version_card_folder_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "award_seasons" DROP CONSTRAINT "award_seasons_card_folder_id_payload_folders_id_fk";
  
  ALTER TABLE "_award_seasons_v" DROP CONSTRAINT "_award_seasons_v_version_card_folder_id_payload_folders_id_fk";
  
  DROP INDEX "award_seasons_card_folder_idx";
  DROP INDEX "_award_seasons_v_version_version_card_folder_idx";
  ALTER TABLE "award_seasons" DROP COLUMN "card_folder_id";
  ALTER TABLE "_award_seasons_v" DROP COLUMN "version_card_folder_id";`)
}
