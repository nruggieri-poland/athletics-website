// Thin REST wrapper around the Payload CMS API (apps/cms). Payload populates
// first-level relationships by default (depth=1), so `team` on a Game or
// `sport` on a Team already come back as full objects, not just IDs.

import { sanitizeUrl } from "./sanitize-url";

const PAYLOAD_URL = import.meta.env.PAYLOAD_URL || "http://localhost:3000";

export type SeasonType = "Fall" | "Winter" | "Spring";

export interface Media {
  id: string;
  alt: string;
  caption?: string;
  url: string;
  sizes?: Record<string, { url: string; width: number; height: number } | undefined>;
}

export interface Sport {
  id: string;
  name: string;
  slug: string;
  seasonType: SeasonType;
  sortOrder: number;
  heroVideoId?: string;
  coverImage?: Media;
}

export interface Season {
  id: string;
  year: string;
  seasonType: SeasonType;
  isCurrent: boolean;
}

export type TeamLevel =
  | "Varsity"
  | "Junior Varsity"
  | "Freshman"
  | "8th Grade"
  | "7th Grade"
  | "Junior High";
export type TeamGender = "Boys" | "Girls" | "Co-Ed";
export type SchoolLevel = "High School" | "Junior High";

export const LEVEL_ORDER: TeamLevel[] = [
  "Varsity",
  "Junior Varsity",
  "Freshman",
  "8th Grade",
  "7th Grade",
  "Junior High",
];

export function sortTeamsByLevel(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
}

// URL segment for a team's level under its sport, e.g. /volleyball/junior-varsity.
// A pure function of the (closed) TeamLevel enum — no CMS field needed.
export function levelSlug(level: TeamLevel): string {
  return level.toLowerCase().replace(/\s+/g, "-");
}

export interface Team {
  id: string;
  sport: Sport;
  level: TeamLevel;
  gender: TeamGender;
  schoolLevel: SchoolLevel;
  slug: string;
  displayName: string;
  shortName?: string;
  isActive: boolean;
}

export type EventType = "Game" | "Practice" | "Scrimmage" | "Other";
export type HomeOrAway = "Home" | "Away" | "Neutral";
export type GameResult = "W" | "L" | "T" | "";

export interface Game {
  id: string;
  team: Team;
  season: Season;
  externalEventId?: string;
  eventType: EventType;
  date: string;
  time?: string;
  time24?: string;
  isTimeTBD: boolean;
  homeOrAway: HomeOrAway;
  opponentName?: string;
  opponentMascot?: string;
  opponentLogo?: Media;
  location?: string;
  isConferenceGame: boolean;
  isCancelled: boolean;
  isPostponed: boolean;
  homeScore?: number;
  awayScore?: number;
  result?: GameResult;
  notes?: string;
  status: "active" | "removed";
}

export type ArticleLinkType = "article" | "external" | "pdf";

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  linkType: ArticleLinkType;
  body?: unknown; // Lexical JSON — only present for linkType "article"
  externalUrl?: string; // only present for linkType "external"
  pdfFile?: Media; // only present for linkType "pdf"
  heroImage: Media;
  relatedTeams?: Team[];
  relatedSports?: Sport[];
  publishedDate: string;
}

// Where clicking an article/news card should actually go — a normal
// article's own page, straight out to an external URL (YouTube, another
// site), or straight to an uploaded PDF. Every card-rendering spot (the
// news index, every sport hub page) funnels through this one function so
// the three link types only need to be handled correctly in one place.
export function articleHref(article: Article): string {
  if (article.linkType === "external" && article.externalUrl) return sanitizeUrl(article.externalUrl);
  if (article.linkType === "pdf" && article.pdfFile) return mediaUrl(article.pdfFile);
  return `/news/${article.slug}`;
}

export function isExternalArticleLink(article: Article): boolean {
  return article.linkType === "external" || article.linkType === "pdf";
}

export type DocumentAudience = "coaches" | "parents" | "both";
export type DocumentFileType = "upload" | "link";

export interface Tag {
  id: string;
  name: string;
  slug: string;
  type: "audience" | "topic";
}

export interface DocumentAsset {
  id: string;
  title: string;
  // Deprecated — superseded by `tags`. Still present on the type since the
  // underlying column hasn't been dropped yet (see Documents.ts).
  audience: DocumentAudience;
  tags?: Tag[];
  isPublic: boolean;
  fileType: DocumentFileType;
  file?: Media;
  externalUrl?: string;
  description?: string;
  sortOrder: number;
  folder?: { id: string; name: string } | null;
}

export function documentHref(doc: DocumentAsset): string {
  if (doc.fileType === "link" && doc.externalUrl) return sanitizeUrl(doc.externalUrl);
  if (doc.file) return mediaUrl(doc.file);
  return "#";
}

export interface SiteSettings {
  siteName: string;
  logo?: Media;
  address?: string;
  primaryColor?: string;
  secondaryColor?: string;
  footerText?: unknown;
  heroVideoId?: string;
  heroHeading?: string;
  heroTagline?: string;
  socialLinks?: { platform: string; url: string }[];
}

export interface NavLink {
  label: string;
  url: string;
  showInHeader?: boolean;
  showInFooter?: boolean;
}

export interface Navigation {
  links?: NavLink[];
}

interface PaginatedDocs<T> {
  docs: T[];
  totalDocs: number;
  totalPages: number;
  page: number;
  hasNextPage: boolean;
}

async function payloadFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${PAYLOAD_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Payload request failed (${res.status}): ${PAYLOAD_URL}${path}`);
  }
  return res.json() as Promise<T>;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function getSports(): Promise<Sport[]> {
  const data = await payloadFetch<PaginatedDocs<Sport>>(
    `/api/sports${toQuery({ limit: 100, sort: "sortOrder" })}`,
  );
  return data.docs;
}

export async function getTeams(): Promise<Team[]> {
  const data = await payloadFetch<PaginatedDocs<Team>>(`/api/teams${toQuery({ limit: 200 })}`);
  return data.docs;
}

export async function getSportBySlug(slug: string): Promise<Sport | null> {
  const data = await payloadFetch<PaginatedDocs<Sport>>(
    `/api/sports${toQuery({ "where[slug][equals]": slug, limit: 1 })}`,
  );
  return data.docs[0] ?? null;
}

export async function getTeamsBySport(sportId: string): Promise<Team[]> {
  const data = await payloadFetch<PaginatedDocs<Team>>(
    `/api/teams${toQuery({ "where[sport][equals]": sportId, limit: 100 })}`,
  );
  return data.docs;
}

export async function getTeamBySlug(slug: string): Promise<Team | null> {
  const data = await payloadFetch<PaginatedDocs<Team>>(
    `/api/teams${toQuery({ "where[slug][equals]": slug, limit: 1 })}`,
  );
  return data.docs[0] ?? null;
}

// OHSAA athletic school year: July 1 through June 30 the following year,
// regardless of season type (Fall/Winter/Spring all fall inside one window).
function getCurrentSchoolYear(referenceDate = new Date()): { start: string; end: string } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed; June = 5, July = 6
  const startYear = month >= 6 ? year : year - 1;
  return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` };
}

export async function getGamesForTeam(teamId: string): Promise<Game[]> {
  const { start, end } = getCurrentSchoolYear();
  const data = await payloadFetch<PaginatedDocs<Game>>(
    `/api/games${toQuery({
      "where[team][equals]": teamId,
      "where[status][equals]": "active",
      // Public schedule shows games only — internal Practices/Scrimmages
      // (about 13% of synced events) are sync-tracked but not fan-facing.
      "where[eventType][equals]": "Game",
      // The full current school-year season always shows, regardless of
      // today's date — a Fall sport shouldn't look "done" once winter hits.
      "where[date][greater_than_equal]": start,
      "where[date][less_than_equal]": end,
      sort: "date",
      limit: 200,
    })}`,
  );
  return data.docs;
}

// Every team's full season under one sport (Varsity through 7th Grade) —
// the data source for a sport hub page: one fetch, then the page derives
// both the "upcoming across all levels" carousel and each level's full
// schedule from the same result, rather than querying once per team.
export async function getSchoolYearGamesForSport(sportId: string): Promise<Game[]> {
  const { start, end } = getCurrentSchoolYear();
  const data = await payloadFetch<PaginatedDocs<Game>>(
    `/api/games${toQuery({
      "where[team.sport][equals]": sportId,
      "where[status][equals]": "active",
      "where[eventType][equals]": "Game",
      "where[date][greater_than_equal]": start,
      "where[date][less_than_equal]": end,
      sort: "date",
      limit: 500,
    })}`,
  );
  return data.docs;
}

// All games (every team) within the current school year — the data source
// for the site-wide /calendar page. Fetched once and filtered/re-rendered
// client-side (by sport, by view) rather than re-querying per interaction.
export async function getSchoolYearGames(): Promise<Game[]> {
  const { start, end } = getCurrentSchoolYear();
  const data = await payloadFetch<PaginatedDocs<Game>>(
    `/api/games${toQuery({
      "where[status][equals]": "active",
      "where[eventType][equals]": "Game",
      "where[date][greater_than_equal]": start,
      "where[date][less_than_equal]": end,
      sort: "date",
      limit: 2000,
    })}`,
  );
  return data.docs;
}

export async function getUpcomingGames(limit = 8): Promise<Game[]> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await payloadFetch<PaginatedDocs<Game>>(
    `/api/games${toQuery({
      "where[status][equals]": "active",
      "where[date][greater_than_equal]": today,
      "where[eventType][equals]": "Game",
      sort: "date",
      limit,
    })}`,
  );
  return data.docs;
}

// Upcoming games across every level of one sport (Varsity through 7th
// Grade) — the sport hub page's "next up" carousel isn't scoped to a
// single team, it's "what's coming up in Boys Basketball, any level."
export async function getUpcomingGamesForSport(sportId: string, limit = 10): Promise<Game[]> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await payloadFetch<PaginatedDocs<Game>>(
    `/api/games${toQuery({
      "where[team.sport][equals]": sportId,
      "where[status][equals]": "active",
      "where[date][greater_than_equal]": today,
      "where[eventType][equals]": "Game",
      sort: "date",
      limit,
    })}`,
  );
  return data.docs;
}

export async function getArticles(limit = 20, page = 1): Promise<PaginatedDocs<Article>> {
  return payloadFetch<PaginatedDocs<Article>>(
    `/api/articles${toQuery({ sort: "-publishedDate", limit, page })}`,
  );
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const data = await payloadFetch<PaginatedDocs<Article>>(
    `/api/articles${toQuery({ "where[slug][equals]": slug, limit: 1 })}`,
  );
  return data.docs[0] ?? null;
}

// An article with no relatedSports selected is treated as broadly relevant
// and shows on every sport's page — only an article that explicitly picks
// OTHER sports (and not this one) is excluded.
export async function getArticlesForSport(sportId: string, limit = 5): Promise<Article[]> {
  const data = await payloadFetch<PaginatedDocs<Article>>(
    `/api/articles${toQuery({
      "where[or][0][relatedSports][exists]": false,
      "where[or][1][relatedSports][in]": sportId,
      sort: "-publishedDate",
      limit,
    })}`,
  );
  return data.docs;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return payloadFetch<SiteSettings>("/api/globals/site-settings");
}

// Every public document, folder populated — the Resources page groups these
// by folder.name itself rather than querying per-folder, so a folder with
// nothing in it just never appears (no empty-state cards to hide).
export async function getAllPublicDocuments(): Promise<DocumentAsset[]> {
  const data = await payloadFetch<PaginatedDocs<DocumentAsset>>(
    `/api/documents${toQuery({
      "where[isPublic][equals]": true,
      sort: "sortOrder",
      limit: 300,
      depth: 2,
    })}`,
  );
  return data.docs;
}

export async function getNavigation(): Promise<Navigation> {
  return payloadFetch<Navigation>("/api/globals/navigation");
}

// Parents/Coaches resource pages each want only the documents tagged for
// them — filters the same public set rather than adding a second API shape
// to keep in sync. Matches on tag.slug (not name) so renaming a tag's label
// later doesn't break this. An untagged document shows on neither page.
export async function getPublicDocumentsByAudience(
  audience: "coaches" | "parents",
): Promise<DocumentAsset[]> {
  const documents = await getAllPublicDocuments();
  return documents.filter((doc) => doc.tags?.some((tag) => tag.slug === audience));
}

// The Fans page's "next home game" spotlight — earliest upcoming Home game
// across every sport/team, or null if nothing's scheduled. Not scoped to
// one team, matching how the Fans page isn't scoped to one team either.
export async function getNextHomeGame(): Promise<Game | null> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await payloadFetch<PaginatedDocs<Game>>(
    `/api/games${toQuery({
      "where[status][equals]": "active",
      "where[eventType][equals]": "Game",
      "where[homeOrAway][equals]": "Home",
      "where[date][greater_than_equal]": today,
      sort: "date",
      limit: 1,
    })}`,
  );
  return data.docs[0] ?? null;
}

export function mediaUrl(media?: Media, size?: string): string {
  if (!media) return "";
  if (size && media.sizes?.[size]?.url) return `${PAYLOAD_URL}${media.sizes[size]!.url}`;
  return `${PAYLOAD_URL}${media.url}`;
}
