// NE8 All-Conference awards — data access and the shared rules every awards
// page renders by (honor order and wording, card sorting, season naming).
// Data comes from the CMS's award-seasons collection (apps/cms/src/
// collections/AwardSeasons.ts): one doc per season, each holding its cards
// in an `awards` array. Honor values/order mirror apps/cms/src/lib/awards.ts.

import type { Media, SeasonType, Sport } from "./payload";

const PAYLOAD_URL = import.meta.env.PAYLOAD_URL || "http://localhost:3000";

export type HonorValue =
  "player-of-the-year" | "coach-of-the-year" | "first-team" | "second-team" | "honorable-mention";

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

export interface HonorMeta {
  value: HonorValue;
  label: string;
  plural: string;
  short: string;
  // Card backdrop behind cut-out photos, and the accent dot/chip color.
  color: string;
  accent: string;
  // Players/Coaches of the Year get the full-strength foil.
  holo: number;
}

export const HONORS: HonorMeta[] = [
  {
    value: "player-of-the-year",
    label: "Player of the Year",
    plural: "Players of the Year",
    short: "POY",
    color: "#8a6a12",
    accent: "#f5c542",
    holo: 1,
  },
  {
    value: "coach-of-the-year",
    label: "Coach of the Year",
    plural: "Coaches of the Year",
    short: "COY",
    color: "#7a5a10",
    accent: "#f5c542",
    holo: 1,
  },
  {
    value: "first-team",
    label: "First Team",
    plural: "First Team",
    short: "1st Team",
    color: "#00328f",
    accent: "#7aa2ff",
    holo: 0.7,
  },
  {
    value: "second-team",
    label: "Second Team",
    plural: "Second Team",
    short: "2nd Team",
    color: "#3a4256",
    accent: "#cbd5e1",
    holo: 0.55,
  },
  {
    value: "honorable-mention",
    label: "Honorable Mention",
    plural: "Honorable Mention",
    short: "HM",
    color: "#2a2c34",
    accent: "#a7abb8",
    holo: 0.4,
  },
];

export const GRADES: Grade[] = ["Senior", "Junior", "Sophomore", "Freshman"];
export const SEASON_ORDER: SeasonType[] = ["Fall", "Winter", "Spring"];

export function honorMeta(value: HonorValue): HonorMeta {
  return HONORS.find((honor) => honor.value === value) ?? HONORS[2];
}

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

// The image a season is represented by on tiles and link previews: its
// chosen cover, else a Player of the Year's photo, else any card's photo.
export function seasonCover(season: AwardSeason): AwardPhoto | undefined {
  if (season.coverImage?.url) return season.coverImage;
  const sorted = sortAwards(season.awards);
  return sorted.find((award) => award.photo?.url)?.photo;
}

// Every published season, newest school year first and Fall → Spring
// within a year. One fetch per build (cached), shared by all awards pages.
let seasonsPromise: Promise<AwardSeason[]> | null = null;

export function getAwardSeasons(): Promise<AwardSeason[]> {
  if (!seasonsPromise) {
    seasonsPromise = (async () => {
      const params = new URLSearchParams({
        "where[isPublic][equals]": "true",
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
