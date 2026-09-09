import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ADD COLUMN "exclude_from_news_feed" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_exclude_from_news_feed" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN "exclude_from_news_feed";
  ALTER TABLE "_articles_v" DROP COLUMN "version_exclude_from_news_feed";`)
}
