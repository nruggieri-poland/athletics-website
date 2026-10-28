// NE8 All-Conference awards — data access and the shared rules every awards
// page renders by (honor order and wording, card sorting, season naming).
// Data comes from the CMS's award-seasons collection (apps/cms/src/
// collections/AwardSeasons.ts): one doc per season, each holding its cards
// in an `awards` array. Honor values, order, and colors come from the
// shared card package (packages/award-card), which the CMS's Instagram
// export draws from too.

import type { HonorMeta, HonorValue } from "@athletics/award-card";
import { HONORS, honorMeta } from "@athletics/award-card";
import type { Media, SeasonType, Sport } from "./payload";

export type { HonorMeta, HonorValue } from "@athletics/award-card";
export { HONORS, honorMeta };

const PAYLOAD_URL = import.meta.env.PAYLOAD_URL || "http://localhost:3000";

export type Grade = "Freshman" | "Sophomore" | "Junior" | "Senior";

export interface AwardPhoto extends Media {
  focalX?: number;
  focalY?: number;
}

export interface Award {
  id: string;
  athleteName: string;
  honor: HonorValue;
  honorTitle?: string;
  grade?: Grade;
  sport: Sport;
  division?: "Boys" | "Girls";
  photo?: AwardPhoto;
}

export interface AwardSeason {
  id: string;
  title: string;
  schoolYear: string;
  season: SeasonType;
  slug: string;
  intro?: string;
  coverImage?: AwardPhoto;
  galleryUrl?: string;
  awards: Award[];
}

export const GRADES: Grade[] = ["Senior", "Junior", "Sophomore", "Freshman"];
export const SEASON_ORDER: SeasonType[] = ["Fall", "Winter", "Spring"];

export function honorLabel(award: Award): string {
  return award.honorTitle || honorMeta(award.honor).label;
}

// "Swimming & Diving" + Girls → "Girls Swimming & Diving"; an already
// gendered sport ("Girls Basketball") is left alone.
export function awardSportLabel(award: Award): string {
  const name = award.sport?.name ?? "";
  if (!award.division || /^(boys|girls)\b/i.test(name)) return name;
  return `${award.division} ${name}`;
}

export function awardSportKey(award: Award): string {
  const label = awardSportLabel(award);
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}

// Honor first (Players of the Year lead), then sport in the Sports
// collection's own order, then last name — so editors never have to order
// the 40 rows in the CMS themselves.
export function sortAwards(awards: Award[]): Award[] {
  const rank = (award: Award) => HONORS.findIndex((honor) => honor.value === award.honor);
  return [...awards].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.sport?.sortOrder ?? 0) - (b.sport?.sortOrder ?? 0) ||
      awardSportLabel(a).localeCompare(awardSportLabel(b)) ||
      lastName(a.athleteName).localeCompare(lastName(b.athleteName)) ||
      a.athleteName.localeCompare(b.athleteName),
  );
}

export function honorCounts(awards: Award[]): { honor: HonorMeta; count: number }[] {
  return HONORS.map((honor) => ({
    honor,
    count: awards.filter((award) => award.honor === honor.value).length,
  })).filter(({ count }) => count > 0);
}

// Distinct people honored — one athlete can earn honors in two sports.
export function honoreeCount(awards: Award[]): number {
  return new Set(awards.map((award) => award.athleteName.trim().toLowerCase())).size;
}

// Fall belongs to a school year's first calendar year, Winter and Spring to
// its second — "Fall 2025", "Winter 2026", "Spring 2026" for 2025-2026,
// matching how the conference names its own honors.
export function seasonYear(season: Pick<AwardSeason, "schoolYear" | "season">): string {
  const [start, end] = season.schoolYear.split("-");
  return season.season === "Fall" ? start : end;
}

export function seasonName(season: Pick<AwardSeason, "schoolYear" | "season">): string {
  return `${season.season} ${seasonYear(season)}`;
}

export function seasonHref(season: Pick<AwardSeason, "schoolYear" | "season">): string {
  return `/ne8/awards/${season.schoolYear}/${season.season.toLowerCase()}`;
}

export function schoolYearHref(schoolYear: string): string {
  return `/ne8/awards/${schoolYear}`;
}

// A card's full-size original upload — the finished artwork, for the
// website to optimize itself (see components/awards/AwardCard.astro).
export function originalUrl(photo?: AwardPhoto): string {
  return photo?.url ? `${PAYLOAD_URL}${photo.url}` : "";
}

export function photoUrl(photo?: AwardPhoto, size = "card"): string {
  if (!photo?.url) return "";
  const sized = photo.sizes?.[size]?.url;
  return `${PAYLOAD_URL}${sized ?? photo.url}`;
}

// Honors the focal point an editor sets on the photo in the CMS, so a
// photo shot wide still frames the athlete's face on a portrait card.
export function photoPosition(photo?: AwardPhoto): string {
  if (typeof photo?.focalX !== "number" || typeof photo?.focalY !== "number") return "50% 30%";
  return `${photo.focalX}% ${photo.focalY}%`;
}

// A season's chosen cover photo (the CMS's "Cover Image"), for the hero and
// tile backgrounds. No fallback to a card: cards are finished artwork with
// their own text and frame, which don't work cropped into a background.
export function seasonCover(season: AwardSeason): AwardPhoto | undefined {
  return season.coverImage?.url ? season.coverImage : undefined;
}

// What a season's link preview shows: its cover, else its first card's
// artwork (in the site's order — a Player of the Year when there is one).
export function seasonShareImage(season: AwardSeason): string | undefined {
  const cover = seasonCover(season);
  if (cover) return photoUrl(cover);
  const card = sortAwards(season.awards).find((award) => award.photo?.url)?.photo;
  return card ? originalUrl(card) : undefined;
}

// Cards with artwork, in the site's order — for tile previews.
export function seasonCardArt(season: AwardSeason, count = 3): AwardPhoto[] {
  return sortAwards(season.awards)
    .map((award) => award.photo)
    .filter((photo): photo is AwardPhoto => Boolean(photo?.url))
    .slice(0, count);
}

// Every published season, newest school year first and Fall → Spring
// within a year. One fetch per build (cached), shared by all awards pages.
// Drafts (never published, or unpublished from the CMS) are left out here
// explicitly rather than trusted to Payload's defaults: a season that's
// never been published still exists in the collection with _status draft.
let seasonsPromise: Promise<AwardSeason[]> | null = null;

export function getAwardSeasons(): Promise<AwardSeason[]> {
  if (!seasonsPromise) {
    seasonsPromise = (async () => {
      const params = new URLSearchParams({
        "where[_status][equals]": "published",
        limit: "200",
        depth: "1",
      });
      const res = await fetch(`${PAYLOAD_URL}/api/award-seasons?${params}`);
      if (!res.ok) throw new Error(`Payload request failed (${res.status}): /api/award-seasons`);
      const data = (await res.json()) as { docs: AwardSeason[] };
      return data.docs
        .map((season) => ({
          ...season,
          awards: (season.awards ?? []).filter((award) => award.athleteName),
        }))
        .sort(
          (a, b) =>
            b.schoolYear.localeCompare(a.schoolYear) ||
            SEASON_ORDER.indexOf(a.season) - SEASON_ORDER.indexOf(b.season),
        );
    })();
  }
  return seasonsPromise;
}

export interface SchoolYearGroup {
  schoolYear: string;
  seasons: AwardSeason[];
  awards: Award[];
}

export function groupBySchoolYear(seasons: AwardSeason[]): SchoolYearGroup[] {
  const groups = new Map<string, AwardSeason[]>();
  for (const season of seasons) {
    groups.set(season.schoolYear, [...(groups.get(season.schoolYear) ?? []), season]);
  }
  return [...groups.entries()].map(([schoolYear, yearSeasons]) => ({
    schoolYear,
    seasons: yearSeasons,
    awards: yearSeasons.flatMap((season) => season.awards),
  }));
}

// The most recently announced season — what the hub features up top. The
// newest school year's last published season (Spring beats Winter beats Fall).
export function latestSeason(seasons: AwardSeason[]): AwardSeason | undefined {
  const [newestYear] = groupBySchoolYear(seasons);
  return newestYear?.seasons[newestYear.seasons.length - 1];
}

// Layout for Player/Coach of the Year cards wherever they're listed: centered,
// at most two to a row and ~448px wide (vs ~270px for the other honors'
// four-across grid) — the top honors are bigger as well as more premium
// (see packages/award-card's premium card).
export const SPOTLIGHT_LIST = "flex flex-wrap justify-center gap-8 lg:gap-12";
export const SPOTLIGHT_ITEM = "w-full max-w-[28rem] sm:w-[calc(50%-1rem)] lg:w-[28rem]";
export const CARD_GRID = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function sportAwardsHref(sportSlug: string): string {
  return `/${sportSlug}/all-conference`;
}

export interface SportAwardYear {
  schoolYear: string;
  season: AwardSeason;
  awards: Award[];
}

// One sport's honors across every published season, newest school year
// first — the data behind /[sport]/all-conference. A sport only plays in one
// season, so each school year holds at most one season's worth of cards.
export function awardsForSport(seasons: AwardSeason[], sportSlug: string): SportAwardYear[] {
  return seasons
    .map((season) => ({
      schoolYear: season.schoolYear,
      season,
      awards: sortAwards(season.awards.filter((award) => award.sport?.slug === sportSlug)),
    }))
    .filter((year) => year.awards.length > 0);
}
