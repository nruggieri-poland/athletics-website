// Minimal, framework-agnostic Lexical JSON -> HTML converter, covering the
// node types Payload's richText editor produces (paragraphs, headings,
// lists, links, basic text formatting, uploaded media, and the custom
// article blocks registered in apps/cms/src/collections/Articles.ts).
// Avoids pulling in @payloadcms/richtext-lexical/react (and therefore a
// React island) just to render article bodies on an otherwise React-free
// site.

import { sanitizeUrl } from "./sanitize-url";
import { mediaUrl } from "./payload";
import type { Media, Team, Game } from "./payload";

interface LexicalNode {
  type: string;
  children?: LexicalNode[];
  text?: string;
  format?: number | string;
  tag?: string;
  listType?: "bullet" | "number";
  url?: string;
  newTab?: boolean;
  value?: { url?: string; alt?: string; filename?: string; mimeType?: string };
  // Deliberately loose — each block type (see apps/cms/src/lib/blocks/)
  // has its own field shape; individual render*Block functions below cast
  // to the specific shape they expect.
  fields?: Record<string, unknown> & { blockType?: string };
}

const TEXT_FORMAT = {
  bold: 1,
  italic: 1 << 1,
  strikethrough: 1 << 2,
  underline: 1 << 3,
  code: 1 << 4,
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderText(node: LexicalNode): string {
  let html = escapeHtml(node.text ?? "");
  const format = typeof node.format === "number" ? node.format : 0;
  if (format & TEXT_FORMAT.code) html = `<code>${html}</code>`;
  if (format & TEXT_FORMAT.bold) html = `<strong>${html}</strong>`;
  if (format & TEXT_FORMAT.italic) html = `<em>${html}</em>`;
  if (format & TEXT_FORMAT.underline) html = `<u>${html}</u>`;
  if (format & TEXT_FORMAT.strikethrough) html = `<s>${html}</s>`;
  return html;
}

function renderChildren(node: LexicalNode, ctx: RenderContext): string {
  return (node.children ?? []).map((child) => renderNode(child, ctx)).join("");
}

// ---------------------------------------------------------------------
// Embed block — YouTube/Vimeo only. See embedBlock.ts (CMS side) for why
// this is a small host allowlist rather than accepting arbitrary iframe
// HTML. Any URL that doesn't match one of these two providers falls back
// to a plain link instead of being iframed.
// ---------------------------------------------------------------------

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1) || null;
    if (parsed.hostname.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.slice("/embed/".length);
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.slice("/shorts/".length);
    }
  } catch {
    // Malformed URL — fall through to the "no match" return below.
  }
  return null;
}

function extractVimeoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "vimeo.com" || hostname.endsWith(".vimeo.com")) {
      const match = parsed.pathname.match(/^\/(\d+)/);
      return match?.[1] ?? null;
    }
  } catch {
    // Malformed URL — fall through to the "no match" return below.
  }
  return null;
}

function renderEmbedBlock(fields: LexicalNode["fields"]): string {
  const url = (fields?.url as string) ?? "";
  const caption = fields?.caption ? escapeHtml(fields.caption as string) : "";

  const youtubeId = extractYouTubeId(url);
  const vimeoId = youtubeId ? null : extractVimeoId(url);

  const src = youtubeId
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}`
    : vimeoId
      ? `https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}`
      : null;

  if (src) {
    const title = escapeHtml(caption || "Embedded video");
    return `<div class="my-6 not-prose"><div class="relative aspect-video overflow-hidden rounded-xl bg-ink-100"><iframe class="absolute inset-0 h-full w-full border-0" src="${escapeHtml(src)}" title="${title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>${caption ? `<p class="mt-2 text-sm text-ink-500">${caption}</p>` : ""}</div>`;
  }

  const safeUrl = sanitizeUrl(url);
  if (safeUrl === "#") return "";
  return `<p class="my-4 not-prose"><a class="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(caption || "Open link")} &#8599;</a></p>`;
}

// ---------------------------------------------------------------------
// Uploads (inline photo/PDF embeds — Payload's default UploadFeature)
// ---------------------------------------------------------------------

const PDF_ICON = "M6 2.5h5l3.5 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 4.5 15V4A1.5 1.5 0 0 1 6 2.5Z";

function renderUpload(node: LexicalNode): string {
  const value = node.value;
  if (!value?.url) return "";
  // mediaUrl() prepends PAYLOAD_URL — Payload's stored/populated url is a
  // path relative to the CMS origin (e.g. "/api/media/file/x.png"), not the
  // Astro site's own origin, so building the src by hand here would
  // silently resolve against the wrong host.
  const safeUrl = escapeHtml(sanitizeUrl(mediaUrl(value as Media)));

  if (value.mimeType === "application/pdf") {
    const label = escapeHtml(value.filename ?? value.alt ?? "PDF document");
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="my-4 flex items-center gap-3 rounded-xl border border-ink-100 bg-surface p-4 no-underline hover:bg-ink-50 not-prose"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700"><svg class="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="${PDF_ICON}" stroke-linecap="round" stroke-linejoin="round" /></svg></span><span class="text-sm font-semibold text-ink-900">${label}</span></a>`;
  }
  return `<img src="${safeUrl}" alt="${escapeHtml(value.alt ?? "")}" loading="lazy" />`;
}

// ---------------------------------------------------------------------
// Pricing Table
// ---------------------------------------------------------------------

interface PricingTableFields {
  heading?: string;
  rows?: { name: string; price: string; description?: string }[];
  contactEmail?: string;
}

function renderPricingTable(fields: LexicalNode["fields"]): string {
  const { heading, rows = [], contactEmail } = (fields ?? {}) as PricingTableFields;
  if (rows.length === 0) return "";
  const rowsHtml = rows
    .map(
      (row) =>
        `<tr class="border-b border-ink-100 last:border-0"><td class="px-4 py-3 font-semibold text-ink-900">${escapeHtml(row.name)}</td><td class="px-4 py-3 text-ink-600">${escapeHtml(row.description ?? "")}</td><td class="px-4 py-3 font-semibold tabular-nums text-ink-900">${escapeHtml(row.price)}</td></tr>`,
    )
    .join("");
  const contact = contactEmail
    ? `<p class="mt-3 text-xs text-ink-500">Questions? Contact <a class="font-semibold text-primary-600 hover:text-primary-700" href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>.</p>`
    : "";
  return `<div class="my-6 not-prose">${heading ? `<h3 class="mb-3 text-base font-semibold text-ink-900">${escapeHtml(heading)}</h3>` : ""}<div class="overflow-x-auto rounded-xl border border-ink-100"><table class="w-full text-sm"><thead><tr class="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-500"><th class="px-4 py-3">Pass</th><th class="px-4 py-3">Covers</th><th class="px-4 py-3">Price</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>${contact}</div>`;
}

// ---------------------------------------------------------------------
// Info Tiles
// ---------------------------------------------------------------------

// Keep in sync with INFO_TILE_ICONS in apps/cms/src/lib/blocks/infoTilesBlock.ts.
const ICON_PATHS: Record<string, string> = {
  parking: "M5 16V6a1 1 0 0 1 1-1h5.5a3.5 3.5 0 1 1 0 7H6m9 4v-4",
  ticket: "M4 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1a1.5 1.5 0 0 0 0 3v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1a1.5 1.5 0 0 0 0-3V8Z",
  bag: "M6 8V6a4 4 0 1 1 8 0v2m-9 0h10l.7 8.5a1.5 1.5 0 0 1-1.5 1.5H5.8a1.5 1.5 0 0 1-1.5-1.5L5 8Z",
  location: "M10 17.5s5.5-5 5.5-9a5.5 5.5 0 1 0-11 0c0 4 5.5 9 5.5 9Zm0-7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  clock: "M10 5.5V10l3 2M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  phone: "M6.5 3.5h2l1 3-1.5 1a9 9 0 0 0 4.5 4.5l1-1.5 3 1v2a1.5 1.5 0 0 1-1.6 1.5A13 13 0 0 1 5 6.1 1.5 1.5 0 0 1 6.5 3.5Z",
  email: "M4 5.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Zm0 0 6 5 6-5",
  info: "M10 6v4.5m0 3.25h.01M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
  star: "M10 2.5l2.2 4.6 5 .7-3.6 3.6.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.6 5-.7L10 2.5Z",
};

interface InfoTilesFields {
  heading?: string;
  tiles?: { icon: string; label: string; value: string; sub?: string }[];
}

function renderInfoTiles(fields: LexicalNode["fields"]): string {
  const { heading, tiles = [] } = (fields ?? {}) as InfoTilesFields;
  if (tiles.length === 0) return "";
  const tilesHtml = tiles
    .map((tile) => {
      const iconPath = ICON_PATHS[tile.icon] ?? ICON_PATHS.info;
      return `<div class="flex items-start gap-3.5 rounded-xl border border-ink-100 p-5"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700"><svg class="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="${iconPath}" stroke-linecap="round" stroke-linejoin="round" /></svg></span><div><p class="text-xs font-semibold uppercase tracking-wide text-ink-500">${escapeHtml(tile.label)}</p><p class="mt-1 text-sm font-semibold leading-snug text-ink-900">${escapeHtml(tile.value)}</p>${tile.sub ? `<p class="mt-0.5 text-xs text-ink-500">${escapeHtml(tile.sub)}</p>` : ""}</div></div>`;
    })
    .join("");
  return `<div class="my-6 not-prose">${heading ? `<h3 class="mb-3 text-base font-semibold text-ink-900">${escapeHtml(heading)}</h3>` : ""}<div class="grid gap-4 sm:grid-cols-2">${tilesHtml}</div></div>`;
}

// ---------------------------------------------------------------------
// Callout Banner
// ---------------------------------------------------------------------

interface CalloutBannerFields {
  tone?: "info" | "warning";
  title?: string;
  body?: string;
}

function renderCalloutBanner(fields: LexicalNode["fields"]): string {
  const { tone = "info", title, body } = (fields ?? {}) as CalloutBannerFields;
  if (!title || !body) return "";
  const isWarning = tone === "warning";
  const boxClass = isWarning ? "border-amber-200 bg-amber-50" : "border-primary-200 bg-primary-50";
  const iconClass = isWarning ? "text-amber-600" : "text-primary-600";
  const titleClass = isWarning ? "text-amber-900" : "text-primary-900";
  const bodyClass = isWarning ? "text-amber-800" : "text-primary-800";
  return `<div class="my-6 not-prose flex items-start gap-3 rounded-xl border ${boxClass} px-5 py-4"><svg class="mt-0.5 h-5 w-5 shrink-0 ${iconClass}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="${ICON_PATHS.info}" stroke-linecap="round" stroke-linejoin="round" /></svg><div><p class="text-sm font-semibold ${titleClass}">${escapeHtml(title)}</p><p class="mt-0.5 text-sm ${bodyClass}">${escapeHtml(body)}</p></div></div>`;
}

// ---------------------------------------------------------------------
// CTA Band
// ---------------------------------------------------------------------

interface CtaBandFields {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

function renderCtaBand(fields: LexicalNode["fields"]): string {
  const { title, body, ctaLabel, ctaUrl } = (fields ?? {}) as CtaBandFields;
  if (!title || !ctaLabel || !ctaUrl) return "";
  const safeUrl = sanitizeUrl(ctaUrl);
  if (safeUrl === "#") return "";
  return `<div class="my-6 not-prose flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-primary-600 px-9 py-8 text-white"><div><h3 class="text-xl font-extrabold">${escapeHtml(title)}</h3>${body ? `<p class="mt-1 max-w-[46ch] text-sm text-white/85">${escapeHtml(body)}</p>` : ""}</div><a href="${escapeHtml(safeUrl)}" class="shrink-0 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary-700 hover:bg-primary-50">${escapeHtml(ctaLabel)}</a></div>`;
}

// ---------------------------------------------------------------------
// Photo Grid
// ---------------------------------------------------------------------

interface PhotoGridFields {
  heading?: string;
  photos?: { image?: Media; caption?: string }[];
}

function renderPhotoGrid(fields: LexicalNode["fields"]): string {
  const { heading, photos = [] } = (fields ?? {}) as PhotoGridFields;
  const valid = photos.filter((p) => p.image?.url);
  if (valid.length === 0) return "";
  const photosHtml = valid
    .map((p) => {
      const src = escapeHtml(sanitizeUrl(mediaUrl(p.image, "card")));
      const alt = escapeHtml(p.image?.alt ?? "");
      const caption = p.caption ? `<figcaption class="mt-1 text-xs text-ink-500">${escapeHtml(p.caption)}</figcaption>` : "";
      return `<figure class="overflow-hidden"><img src="${src}" alt="${alt}" class="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />${caption}</figure>`;
    })
    .join("");
  return `<div class="my-6 not-prose">${heading ? `<h3 class="mb-3 text-base font-semibold text-ink-900">${escapeHtml(heading)}</h3>` : ""}<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">${photosHtml}</div></div>`;
}

// ---------------------------------------------------------------------
// Schedule Snippet — the one block that needs live data. lexicalToHtml
// stays synchronous (see the file header comment for why); a two-pass
// approach keeps it that way: extractScheduleSnippetTeamIds() runs first
// against the raw body so the calling page can fetch each referenced
// team's real games, then that data is threaded through as `context` when
// lexicalToHtml actually renders.
// ---------------------------------------------------------------------

interface ScheduleSnippetFields {
  team?: { id?: string | number } | string | number;
  mode?: "upcoming" | "recent";
  limit?: number;
}

function teamIdFromFieldValue(value: ScheduleSnippetFields["team"]): string | null {
  if (value == null) return null;
  if (typeof value === "object") return value.id != null ? String(value.id) : null;
  return String(value);
}

export function extractScheduleSnippetTeamIds(body: unknown): string[] {
  const ids = new Set<string>();
  function walk(node: LexicalNode) {
    if (node.type === "block" && node.fields?.blockType === "scheduleSnippet") {
      const id = teamIdFromFieldValue((node.fields as ScheduleSnippetFields).team);
      if (id) ids.add(id);
    }
    node.children?.forEach(walk);
  }
  const root = (body as { root?: LexicalNode })?.root;
  if (root) walk(root);
  return [...ids];
}

export interface ScheduleSnippetData {
  team: Team;
  games: Game[];
}

interface RenderContext {
  scheduleData?: Map<string, ScheduleSnippetData>;
}

function formatSnippetDate(dateStr: string): string {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function renderScheduleSnippet(fields: LexicalNode["fields"], ctx: RenderContext): string {
  const { team: teamField, mode = "upcoming", limit = 5 } = (fields ?? {}) as ScheduleSnippetFields;
  const teamId = teamIdFromFieldValue(teamField);
  const data = teamId ? ctx.scheduleData?.get(teamId) : undefined;
  if (!data) return "";

  const today = new Date().toISOString().slice(0, 10);
  const games = data.games
    .filter((game) => (mode === "recent" ? game.date < today : game.date >= today))
    .sort((a, b) => (mode === "recent" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
    .slice(0, limit);

  const heading = `${escapeHtml(data.team.displayName)} — ${mode === "recent" ? "Recent Results" : "Upcoming Games"}`;

  if (games.length === 0) {
    return `<div class="my-6 not-prose"><h3 class="mb-3 text-base font-semibold text-ink-900">${heading}</h3><p class="text-sm text-ink-400">Nothing to show right now.</p></div>`;
  }

  const rows = games
    .map((game) => {
      const vsOrAt = game.homeOrAway === "Home" ? "vs" : game.homeOrAway === "Away" ? "@" : "";
      const opponent = escapeHtml(game.opponentName ?? "TBD");
      const dateLabel = escapeHtml(formatSnippetDate(game.date));
      const timeLabel = game.isTimeTBD || !game.time ? "" : ` · ${escapeHtml(game.time)}`;
      const result =
        mode === "recent" && game.result
          ? `<span class="shrink-0 text-sm font-bold text-ink-900">${escapeHtml(game.result)}${game.homeScore != null && game.awayScore != null ? ` ${game.homeScore}-${game.awayScore}` : ""}</span>`
          : "";
      return `<div class="flex items-center justify-between gap-3 px-4 py-3"><div><p class="text-sm font-semibold text-ink-900">${vsOrAt} ${opponent}</p><p class="text-xs text-ink-500">${dateLabel}${timeLabel}</p></div>${result}</div>`;
    })
    .join("");

  return `<div class="my-6 not-prose"><h3 class="mb-3 text-base font-semibold text-ink-900">${heading}</h3><div class="divide-y divide-ink-100 rounded-xl border border-ink-100 bg-surface">${rows}</div></div>`;
}

// ---------------------------------------------------------------------
// Pull Quote
// ---------------------------------------------------------------------

interface PullQuoteFields {
  quote?: string;
  attribution?: string;
}

function renderPullQuote(fields: LexicalNode["fields"]): string {
  const { quote, attribution } = (fields ?? {}) as PullQuoteFields;
  if (!quote) return "";
  return `<figure class="my-6 not-prose border-l-4 border-primary-600 pl-5"><blockquote class="text-lg font-semibold italic leading-snug text-ink-900">&ldquo;${escapeHtml(quote)}&rdquo;</blockquote>${attribution ? `<figcaption class="mt-2 text-sm font-medium text-ink-500">&mdash; ${escapeHtml(attribution)}</figcaption>` : ""}</figure>`;
}

// ---------------------------------------------------------------------
// Sponsor Shoutout
// ---------------------------------------------------------------------

interface SponsorShoutoutFields {
  name?: string;
  logo?: Media;
  message?: string;
  url?: string;
}

function renderSponsorShoutout(fields: LexicalNode["fields"]): string {
  const { name, logo, message, url } = (fields ?? {}) as SponsorShoutoutFields;
  if (!name) return "";
  const logoHtml = logo?.url
    ? `<img src="${escapeHtml(sanitizeUrl(mediaUrl(logo, "thumbnail")))}" alt="" class="h-12 w-12 shrink-0 rounded-lg object-contain" loading="lazy" />`
    : "";
  const nameHtml = escapeHtml(name);
  const safeUrl = url ? sanitizeUrl(url) : "";
  const nameBlock = safeUrl && safeUrl !== "#"
    ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="text-sm font-bold text-ink-900 hover:text-primary-600">${nameHtml} &#8599;</a>`
    : `<p class="text-sm font-bold text-ink-900">${nameHtml}</p>`;
  return `<div class="my-6 not-prose flex items-center gap-4 rounded-xl border border-ink-100 bg-surface p-5">${logoHtml}<div>${nameBlock}${message ? `<p class="mt-0.5 text-sm text-ink-500">${escapeHtml(message)}</p>` : ""}</div></div>`;
}

// ---------------------------------------------------------------------

function renderNode(node: LexicalNode, ctx: RenderContext): string {
  switch (node.type) {
    case "text":
      return renderText(node);
    case "paragraph":
      return `<p>${renderChildren(node, ctx)}</p>`;
    case "heading": {
      // Every article page already has its own <h1> (the title) — clamp
      // editor-authored headings to h2+ so they can't create a second h1 or
      // otherwise break the page's heading hierarchy.
      const tag = node.tag === "h1" ? "h2" : (node.tag ?? "h2");
      return `<${tag}>${renderChildren(node, ctx)}</${tag}>`;
    }
    case "list":
      return node.listType === "number"
        ? `<ol>${renderChildren(node, ctx)}</ol>`
        : `<ul>${renderChildren(node, ctx)}</ul>`;
    case "listitem":
      return `<li>${renderChildren(node, ctx)}</li>`;
    case "quote":
      return `<blockquote>${renderChildren(node, ctx)}</blockquote>`;
    case "link": {
      const url = sanitizeUrl(node.fields?.url as string ?? node.url ?? "#");
      const target = node.fields?.newTab || node.newTab ? ' target="_blank" rel="noopener"' : "";
      return `<a href="${escapeHtml(url)}"${target}>${renderChildren(node, ctx)}</a>`;
    }
    case "linebreak":
      return "<br />";
    case "upload":
      return renderUpload(node);
    case "block":
      switch (node.fields?.blockType) {
        case "embed":
          return renderEmbedBlock(node.fields);
        case "pricingTable":
          return renderPricingTable(node.fields);
        case "infoTiles":
          return renderInfoTiles(node.fields);
        case "calloutBanner":
          return renderCalloutBanner(node.fields);
        case "ctaBand":
          return renderCtaBand(node.fields);
        case "photoGrid":
          return renderPhotoGrid(node.fields);
        case "scheduleSnippet":
          return renderScheduleSnippet(node.fields, ctx);
        case "pullQuote":
          return renderPullQuote(node.fields);
        case "sponsorShoutout":
          return renderSponsorShoutout(node.fields);
        default:
          return "";
      }
    default:
      return renderChildren(node, ctx);
  }
}

export function lexicalToHtml(body: unknown, context: RenderContext = {}): string {
  const root = (body as { root?: LexicalNode })?.root;
  if (!root) return "";
  return renderChildren(root, context);
}
