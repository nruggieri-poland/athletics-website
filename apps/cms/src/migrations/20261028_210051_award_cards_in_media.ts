// payload-deploy:allow-destructive — reviewed and approved: up() drops only
// the old "Drop in card images" link tables (uploads waiting to be matched)
// and the foreign keys being swapped from award-photos to media, after
// copying every card image into Media and re-pointing awards at the copies.
// The award-photos collection, its table, and its files are left in place.
import fs from 'node:fs'
import path from 'node:path'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

// NE8 award card images move from their own upload collection (award-photos)
// into the regular Media library, where the editor already organizes files
// into folders; awards now link to Media (see AwardSeasons.ts), and the
// "Drop in card images" field is replaced by a "Match card images" button.
//
// Nothing uploaded is lost: every existing card image is copied into Media
// (folder "NE8 Award Cards") and each award / season cover is re-pointed at
// its copy before the old links are replaced. The award-photos collection,
// its table and its files are left in place (hidden in the admin) for a
// later cleanup. The only things dropped are the old drop box's link tables
// (award_seasons_rels and its version twin), which held nothing but
// uploads-waiting-to-be-matched, and the foreign keys being replaced.

const CARD_COLUMNS = [
  ['award_seasons_awards', 'photo_id'],
  ['award_seasons', 'cover_image_id'],
  ['_award_seasons_v_version_awards', 'photo_id'],
  ['_award_seasons_v', 'version_cover_image_id'],
] as const

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // 1. Unhook from the legacy collection.
  await db.execute(sql`
  ALTER TABLE "award_seasons_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_award_seasons_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "award_seasons_rels" CASCADE;
  DROP TABLE "_award_seasons_v_rels" CASCADE;
  ALTER TABLE "award_seasons_awards" DROP CONSTRAINT "award_seasons_awards_photo_id_award_photos_id_fk";
  ALTER TABLE "award_seasons" DROP CONSTRAINT "award_seasons_cover_image_id_award_photos_id_fk";
  ALTER TABLE "_award_seasons_v_version_awards" DROP CONSTRAINT "_award_seasons_v_version_awards_photo_id_award_photos_id_fk";
  ALTER TABLE "_award_seasons_v" DROP CONSTRAINT "_award_seasons_v_version_cover_image_id_award_photos_id_fk";
  ALTER TABLE "media" ALTER COLUMN "alt" DROP NOT NULL;`)

  // 2. Copy every legacy card image into Media, remembering old id → new id.
  // `skipRebuild`: deploy.sh rebuilds the site right after migrating.
  const context = { skipRebuild: true }
  const legacy = await payload.find({
    collection: 'award-photos',
    limit: 0,
    pagination: false,
    depth: 0,
    req,
  })
  const remap: [number, number][] = []
  if (legacy.docs.length > 0) {
    const folder = await payload.create({
      collection: 'payload-folders',
      data: { name: 'NE8 Award Cards' },
      req,
      context,
    })
    const staticDir = payload.collections['award-photos'].config.upload.staticDir ?? 'award-photos'
    for (const doc of legacy.docs) {
      const filePath = doc.filename
        ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), staticDir, doc.filename)
        : ''
      if (!filePath || !fs.existsSync(filePath)) {
        payload.logger.warn(
          `[migrate] Card image ${doc.filename ?? doc.id} is missing on disk — not copied.`,
        )
        continue
      }
      const media = await payload.create({
        collection: 'media',
        data: { alt: doc.alt || undefined, folder: folder.id } as never,
        filePath,
        req,
        context,
      })
      remap.push([Number(doc.id), Number(media.id)])
    }
  }

  // 3. Point every card and cover at its copy (anything without one —
  // a file missing on disk — is unlinked rather than left dangling).
  await db.execute(
    sql`CREATE TEMP TABLE "card_image_remap" ("old_id" integer PRIMARY KEY, "new_id" integer)`,
  )
  if (remap.length > 0) {
    await db.execute(
      sql`INSERT INTO "card_image_remap" VALUES ${sql.join(
        remap.map(([oldId, newId]) => sql`(${oldId}, ${newId})`),
        sql`, `,
      )}`,
    )
  }
  for (const [table, column] of CARD_COLUMNS) {
    await db.execute(
      sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = (SELECT "new_id" FROM "card_image_remap" WHERE "old_id" = ${sql.identifier(table)}.${sql.identifier(column)}) WHERE ${sql.identifier(column)} IS NOT NULL`,
    )
  }

  await db.execute(sql`DROP TABLE "card_image_remap"`)

  // 4. Link to Media.
  await db.execute(sql`
  ALTER TABLE "award_seasons_awards" ADD CONSTRAINT "award_seasons_awards_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "award_seasons" ADD CONSTRAINT "award_seasons_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_award_seasons_v_version_awards" ADD CONSTRAINT "_award_seasons_v_version_awards_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_award_seasons_v" ADD CONSTRAINT "_award_seasons_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "award_seasons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"award_photos_id" integer
  );
  
  CREATE TABLE "_award_seasons_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"award_photos_id" integer
  );
  
  ALTER TABLE "award_seasons_awards" DROP CONSTRAINT "award_seasons_awards_photo_id_media_id_fk";
  
  ALTER TABLE "award_seasons" DROP CONSTRAINT "award_seasons_cover_image_id_media_id_fk";
  
  ALTER TABLE "_award_seasons_v_version_awards" DROP CONSTRAINT "_award_seasons_v_version_awards_photo_id_media_id_fk";
  
  ALTER TABLE "_award_seasons_v" DROP CONSTRAINT "_award_seasons_v_version_cover_image_id_media_id_fk";
  
  -- Hand-added: card links now point at Media rows, which the restored
  -- award_photos foreign keys below would reject — so a rollback unlinks
  -- card images (the Media copies stay; re-attach by hand if needed).
  UPDATE "award_seasons_awards" SET "photo_id" = NULL;
  UPDATE "award_seasons" SET "cover_image_id" = NULL;
  UPDATE "_award_seasons_v_version_awards" SET "photo_id" = NULL;
  UPDATE "_award_seasons_v" SET "version_cover_image_id" = NULL;
  UPDATE "media" SET "alt" = COALESCE(NULLIF("alt", ''), "filename", '') WHERE "alt" IS NULL OR "alt" = '';
  ALTER TABLE "media" ALTER COLUMN "alt" SET NOT NULL;
  ALTER TABLE "award_seasons_rels" ADD CONSTRAINT "award_seasons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."award_seasons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "award_seasons_rels" ADD CONSTRAINT "award_seasons_rels_award_photos_fk" FOREIGN KEY ("award_photos_id") REFERENCES "public"."award_photos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_award_seasons_v_rels" ADD CONSTRAINT "_award_seasons_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_award_seasons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_award_seasons_v_rels" ADD CONSTRAINT "_award_seasons_v_rels_award_photos_fk" FOREIGN KEY ("award_photos_id") REFERENCES "public"."award_photos"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "award_seasons_rels_order_idx" ON "award_seasons_rels" USING btree ("order");
  CREATE INDEX "award_seasons_rels_parent_idx" ON "award_seasons_rels" USING btree ("parent_id");
  CREATE INDEX "award_seasons_rels_path_idx" ON "award_seasons_rels" USING btree ("path");
  CREATE INDEX "award_seasons_rels_award_photos_id_idx" ON "award_seasons_rels" USING btree ("award_photos_id");
  CREATE INDEX "_award_seasons_v_rels_order_idx" ON "_award_seasons_v_rels" USING btree ("order");
  CREATE INDEX "_award_seasons_v_rels_parent_idx" ON "_award_seasons_v_rels" USING btree ("parent_id");
  CREATE INDEX "_award_seasons_v_rels_path_idx" ON "_award_seasons_v_rels" USING btree ("path");
  CREATE INDEX "_award_seasons_v_rels_award_photos_id_idx" ON "_award_seasons_v_rels" USING btree ("award_photos_id");
  ALTER TABLE "award_seasons_awards" ADD CONSTRAINT "award_seasons_awards_photo_id_award_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."award_photos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "award_seasons" ADD CONSTRAINT "award_seasons_cover_image_id_award_photos_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."award_photos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_award_seasons_v_version_awards" ADD CONSTRAINT "_award_seasons_v_version_awards_photo_id_award_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."award_photos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_award_seasons_v" ADD CONSTRAINT "_award_seasons_v_version_cover_image_id_award_photos_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."award_photos"("id") ON DELETE set null ON UPDATE no action;`)
}
