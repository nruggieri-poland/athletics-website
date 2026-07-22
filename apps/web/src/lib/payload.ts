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
  mimeType?: string;
  sizes?: Record<string, { url: string; width: number; height: number } | undefined>;
  title?: string;
  description?: string;
  sortOrder?: number;
  tags?: Tag[];
  isPublic?: boolean;
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

export interface Opponent {
  id: string;
  name: string;
  mascot?: string;
  aliases?: { alias: string }[];
  logo?: Media;
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
  // Not part of the API response — attached by attachOpponentLogos() below,
  // resolved live against the Opponents collection at build time. See its
  // comment for why this isn't a field Payload returns directly.
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
  tags?: Tag[];
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

// A single, open taxonomy shared across the whole site — Media, Links,
// Galleries, and Articles all carry the same `tags` field.
export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export type LinkType = "external" | "video";

export interface Link {
  id: string;
  title: string;
  linkType: LinkType;
  url?: string; // present when linkType === "external"
  videoId?: string; // present when linkType === "video"
  description?: string;
  logo?: Media;
  ctaLabel?: string;
  placement?: "none" | "photos" | "watchLive";
  isPublic: boolean;
  sortOrder: number;
  tags?: Tag[];
}

// Payload's stored shape for a polymorphic relationship value is a
// discriminated union, not a bare populated doc — confirmed both from
// generated types and a live API response: { relationTo: '<slug>', value }.
export type GalleryItemRef =
  | { relationTo: "media"; value: Media }
  | { relationTo: "links"; value: Link };

export interface GallerySectionItem {
  item: GalleryItemRef;
  caption?: string;
}

export interface GallerySection {
  heading?: string;
  items: GallerySectionItem[];
}

export interface Gallery {
  id: string;
  title: string;
  slug: string;
  description?: string;
  isPublic: boolean;
  sections: GallerySection[];
}

// Analogous to articleHref, but branches on the polymorphic relationTo
// discriminator instead of a single collection's own type field.
export function galleryItemHref(ref: GalleryItemRef): string {
  if (ref.relationTo === "media") return mediaUrl(ref.value);
  const link = ref.value;
  if (link.linkType === "video" && link.videoId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(link.videoId)}`;
  }
  if (link.linkType === "external" && link.url) return sanitizeUrl(link.url);
  return "#";
}

export function galleryItemTitle(ref: GalleryItemRef): string {
  return ref.relationTo === "media" ? ref.value.title || ref.value.alt : ref.value.title;
}

export function isExternalGalleryItem(ref: GalleryItemRef): boolean {
  return ref.relationTo === "links";
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
  group?: "primary" | "more";
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

function normalizeOpponentKey(value: string): string {
  return value.trim().toLowerCase();
}

// Astro's build (`astro build`) runs every Game-returning function below in
// the same process, once per site rebuild — this cache means Opponents is
// only fetched once per build, not once per page, while still resolving
// fresh from the CMS on every rebuild (no write-time copy on Game itself
// that could go stale between edits in the Opponents admin and the games
// that reference it).
let opponentLogoIndexPromise: Promise<Map<string, Media>> | null = null;

async function getOpponentLogoIndex(): Promise<Map<string, Media>> {
  if (!opponentLogoIndexPromise) {
    opponentLogoIndexPromise = (async () => {
      const data = await payloadFetch<PaginatedDocs<Opponent>>(
        `/api/opponents${toQuery({ limit: 1000 })}`,
      );
      const index = new Map<string, Media>();
      for (const opponent of data.docs) {
        if (!opponent.logo) continue;
        const names = [opponent.name, ...(opponent.aliases ?? []).map((entry) => entry.alias)];
        for (const name of names) {
          if (name) index.set(normalizeOpponentKey(name), opponent.logo);
        }
      }
      return index;
    })();
  }
  return opponentLogoIndexPromise;
}

// Matches each game's opponentName against the Opponents collection (by
// name or alias, case-insensitive) and attaches the logo directly onto the
// Game object — every Game-returning function below calls this before
// returning, so components keep reading game.opponentLogo exactly as
// before.
async function attachOpponentLogos<T extends Game | null>(games: T[]): Promise<T[]> {
  const index = await getOpponentLogoIndex();
  for (const game of games) {
    if (game?.opponentName) game.opponentLogo = index.get(normalizeOpponentKey(game.opponentName));
  }
  return games;
}

export async function getGamesForTeam(teamId: string): Promise<Game[]> {
  const { start, end } = getCurrentSchoolYear();
  const data = await payloadFetch<PaginatedDocs<Game>>(
    `/api/games${toQuery({
      "where[team][equals]": teamId,
      "where[status][equals]": "active",
      // Public schedule shows Games and Scrimmages (tagged as such in the
      // UI) — internal Practices/Other events are sync-tracked but not
      // fan-facing.
      "where[eventType][in]": "Game,Scrimmage",
      // The full current school-year season always shows, regardless of
      // today's date — a Fall sport shouldn't look "done" once winter hits.
      "where[date][greater_than_equal]": start,
      "where[date][less_than_equal]": end,
      sort: "date",
      limit: 200,
    })}`,
  );
  return attachOpponentLogos(data.docs);
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
      "where[eventType][in]": "Game,Scrimmage",
      "where[date][greater_than_equal]": start,
      "where[date][less_than_equal]": end,
      sort: "date",
      limit: 500,
    })}`,
  );
  return attachOpponentLogos(data.docs);
}

// All games (every team) within the current school year — the data source
// for the site-wide /calendar page. Fetched once and filtered/re-rendered
// client-side (by sport, by view) rather than re-querying per interaction.
export async function getSchoolYearGames(): Promise<Game[]> {
  const { start, end } = getCurrentSchoolYear();
  const data = await payloadFetch<PaginatedDocs<Game>>(
    `/api/games${toQuery({
      "where[status][equals]": "active",
      "where[eventType][in]": "Game,Scrimmage",
      "where[date][greater_than_equal]": start,
      "where[date][less_than_equal]": end,
      sort: "date",
      limit: 2000,
    })}`,
  );
  return attachOpponentLogos(data.docs);
}

export async function getUpcomingGames(limit = 8): Promise<Game[]> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await payloadFetch<PaginatedDocs<Game>>(
    `/api/games${toQuery({
      "where[status][equals]": "active",
      "where[date][greater_than_equal]": today,
      "where[eventType][in]": "Game,Scrimmage",
      sort: "date",
      limit,
    })}`,
  );
  return attachOpponentLogos(data.docs);
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
      "where[eventType][in]": "Game,Scrimmage",
      sort: "date",
      limit,
    })}`,
  );
  return attachOpponentLogos(data.docs);
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

// Unlike getArticlesForSport, this is strictly opt-in — an article shows
// here only if it's explicitly tagged, since "Fans" isn't a broad default
// the way an untagged article defaults to "relevant to every sport."
export async function getArticlesForTag(tagSlug: string, limit = 12): Promise<Article[]> {
  const data = await payloadFetch<PaginatedDocs<Article>>(
    `/api/articles${toQuery({
      "where[tags.slug][equals]": tagSlug,
      sort: "-publishedDate",
      limit,
    })}`,
  );
  return data.docs;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return payloadFetch<SiteSettings>("/api/globals/site-settings");
}

export async function getNavigation(): Promise<Navigation> {
  return payloadFetch<Navigation>("/api/globals/navigation");
}

// Looked up by slug from a developer-wired page (e.g. Resources → Parents)
// to render one hand-curated gallery. depth=2 populates each section
// item's polymorphic `value` as a full Media/Link doc, one hop past
// Payload's default depth=1.
export async function getGalleryBySlug(slug: string): Promise<Gallery | null> {
  const data = await payloadFetch<PaginatedDocs<Gallery>>(
    `/api/galleries${toQuery({
      "where[slug][equals]": slug,
      "where[isPublic][equals]": true,
      limit: 1,
      depth: 2,
    })}`,
  );
  return data.docs[0] ?? null;
}

// Looked up by a Link's own `placement` field (e.g. "photos", "watchLive")
// from a developer-wired page that renders each matching Link as a CTA
// card — the Magic Moments / Poland Local Schools Photos / YSN / Hudl
// cards, none of which fit the Gallery model since they're single
// standalone CTAs, not a curated collection of items.
export async function getLinksByPlacement(placement: "photos" | "watchLive"): Promise<Link[]> {
  const data = await payloadFetch<PaginatedDocs<Link>>(
    `/api/links${toQuery({
      "where[placement][equals]": placement,
      "where[isPublic][equals]": true,
      sort: "sortOrder",
      limit: 10,
    })}`,
  );
  return data.docs;
}

// The Fans page's "next home game" spotlight — earliest upcoming Home game
// across every sport/team, or null if nothing's scheduled. Not scoped to
// one team, matching how the Fans page isn't scoped to one team either.
export async function getNextHomeGame(): Promise<Game | null> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await payloadFetch<PaginatedDocs<Game>>(
    `/api/games${toQuery({
      "where[status][equals]": "active",
      "where[eventType][in]": "Game,Scrimmage",
      "where[homeOrAway][equals]": "Home",
      "where[date][greater_than_equal]": today,
      sort: "date",
      limit: 1,
    })}`,
  );
  const [game] = await attachOpponentLogos([data.docs[0] ?? null]);
  return game;
}

export function mediaUrl(media?: Media, size?: string): string {
  if (!media) return "";
  if (size && media.sizes?.[size]?.url) return `${PAYLOAD_URL}${media.sizes[size]!.url}`;
  return `${PAYLOAD_URL}${media.url}`;
}
