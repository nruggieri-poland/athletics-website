// The NE8 award card's design, in one place for everything that draws it:
// the website (apps/web/src/components/awards/AwardCard.astro renders
// cardHtml() and loads card.css + engine.js) and the CMS's Instagram export
// (apps/cms/src/lib/instagramExport.ts screenshots posterHtml() in a
// headless browser). Change the card here and both follow.
//
// Plain JavaScript on purpose: the CMS loads its config through Node's own
// TypeScript stripping (`payload migrate --disable-transpile`), which
// refuses .ts files that live under node_modules — and workspace packages
// are symlinked there.

// Card backdrop (behind and around the photo), accent (honor chip, status
// dot) and foil strength per honor. Order is the order cards are listed in.
// Values mirror apps/cms/src/lib/awards.ts's HONORS.
export const HONORS = [
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

export function honorMeta(value) {
  return HONORS.find((honor) => honor.value === value) ?? HONORS[2];
}

// Tileable mask the foil shows through (ProfileCard's iconUrl). Inline SVG
// rather than an uploaded image: CSS masks fetch in CORS mode, and the
// CMS's uploads are served from another origin.
const PATTERN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='#000'><text x='6' y='40' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='28' letter-spacing='-1'>NE8</text><text x='66' y='100' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='28' letter-spacing='-1'>NE8</text><path d='M92 14l3.5 7.2 7.9 1.1-5.7 5.6 1.3 7.9-7-3.7-7 3.7 1.3-7.9-5.7-5.6 7.9-1.1z'/><path d='M30 74l3.5 7.2 7.9 1.1-5.7 5.6 1.3 7.9-7-3.7-7 3.7 1.3-7.9-5.7-5.6 7.9-1.1z'/></g></svg>",
)}")`;

// ProfileCard's film grain for the foil's glow layer, verbatim.
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='500' height='500'><filter id='g' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0.55 0 0 0 -0.24 0.55 0 0 0 -0.24 0.55 0 0 0 -0.24 0 0 0 0 1'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>",
)}")`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function initialsOf(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// A fixed tilt-and-light pose, as the CSS variables engine.js would write
// for a cursor resting at (x, y) in -1…1 with the light at `light` (0…1).
// Lets a still image catch the foil the way a hovered card does. Light
// position is in percent so it doesn't depend on the card's pixel size.
export function poseStyle({ x = 0, y = 0, light = 0, tilt = 12, parallax = 8 } = {}) {
  const reach = Math.min(1, Math.hypot(x, y));
  return [
    `--pc-light-x: ${((x + 1) * 50).toFixed(2)}%`,
    `--pc-light-y: ${((y + 1) * 50).toFixed(2)}%`,
    `--pc-pointer-x: ${((x + 1) * 50).toFixed(2)}%`,
    `--pc-pointer-y: ${((y + 1) * 50).toFixed(2)}%`,
    `--pc-band-x: ${(50 + x * 15).toFixed(2)}%`,
    `--pc-band-y: ${(50 + y * 15).toFixed(2)}%`,
    `--pc-rotate-x: ${(y * tilt).toFixed(3)}deg`,
    `--pc-rotate-y: ${(-x * tilt).toFixed(3)}deg`,
    `--pc-shift-x: ${(x * parallax).toFixed(2)}px`,
    `--pc-shift-y: ${(y * parallax).toFixed(2)}px`,
    `--pc-reach: ${reach.toFixed(4)}`,
    `--pc-tilt: ${(reach * light).toFixed(4)}`,
    `--pc-active: ${light.toFixed(4)}`,
  ].join("; ");
}

// One card's markup. Expects card.css on the page. On the website,
// engine.js's initAwardCards() brings [data-award-card] elements to life;
// without it (the export) the card holds whatever pose `style` gives it.
export function cardHtml({
  name,
  honor,
  honorText,
  sportLabel,
  statusText,
  year,
  seasonLabel,
  photoSrc,
  photoPosition = "50% 30%",
  teamHref,
  intro = true,
  lazy = true,
  className = "",
  style = "",
}) {
  const meta = honorMeta(honor);
  const vars = [
    `--pc-backdrop: linear-gradient(180deg, color-mix(in srgb, ${meta.color}, #ffffff 12%) 0%, color-mix(in srgb, ${meta.color}, #000000 30%) 100%)`,
    `--pc-holo: ${meta.holo}`,
    `--pc-glare: 0.5`,
    `--pc-accent: ${meta.accent}`,
    `--pc-pattern: ${PATTERN}`,
    `--pc-grain: ${GRAIN}`,
    `--pc-photo-position: ${photoPosition}`,
    style,
  ]
    .filter(Boolean)
    .join("; ");
  const classes = ["profile-card", photoSrc ? "profile-card--photo" : "", className].filter(Boolean).join(" ");
  const label = `${name}, ${honorText ?? meta.label}, ${sportLabel}`;
  const yearText = String(year ?? "");

  const photo = photoSrc
    ? `<img class="profile-card__photo" src="${escapeHtml(photoSrc)}" alt=""${lazy ? ' loading="lazy" decoding="async"' : ""} draggable="false" />`
    : `<span class="profile-card__monogram" aria-hidden="true">${escapeHtml(initialsOf(name))}</span>`;

  const team = teamHref
    ? `<a href="${escapeHtml(teamHref)}" class="profile-card__contact" aria-label="${escapeHtml(`${sportLabel} team page`)}">Team<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>`
    : "";

  // The foil (__holo) sits above the photo, unlike ProfileCard (which
  // expects cut-out portraits and lets the foil show around them): full-
  // bleed action shots would hide it entirely. See .profile-card--photo.
  return `<article class="${escapeHtml(classes)}" style="${escapeHtml(vars)}" data-award-card data-intro="${intro ? "true" : "false"}" aria-label="${escapeHtml(label)}">
  <div class="profile-card__body">
    <div class="profile-card__tile">
      <span class="profile-card__sheen"></span>
      ${photo}
      <span class="profile-card__holo"><span class="profile-card__holo-glow"></span><span class="profile-card__holo-shift"></span></span>
      <span class="profile-card__year" aria-hidden="true"><span>${escapeHtml(yearText.slice(0, 2))}</span><span>${escapeHtml(yearText.slice(2))}</span></span>
      <span class="profile-card__badge" aria-hidden="true">NE8</span>
      <span class="profile-card__scrim"></span>
      <div class="profile-card__info">
        <p class="profile-card__honor">${escapeHtml(honorText ?? meta.label)}</p>
        <h3 class="profile-card__name">${escapeHtml(name)}</h3>
        <p class="profile-card__title">NE8 All-Conference · ${escapeHtml(seasonLabel)}</p>
      </div>
      <span class="profile-card__tile-rim"></span>
    </div>
    <div class="profile-card__footer">
      <div class="profile-card__meta">
        <span class="profile-card__handle">${escapeHtml(sportLabel)}</span>
        ${statusText ? `<span class="profile-card__status">${escapeHtml(statusText)}</span>` : ""}
      </div>
      ${team}
    </div>
    <span class="profile-card__glare"></span>
    <span class="profile-card__shade"></span>
    <span class="profile-card__rim"></span>
  </div>
</article>`;
}

// Output sizes, in CSS pixels. The export screenshots at 2× device pixel
// ratio, so the PNGs are 2160×2700 (feed) and 2160×3840 (story) — Instagram's
// own 4:5 and 9:16 shapes at double its 1080-wide upload size.
export const POSTER_FORMATS = {
  feed: { width: 1080, height: 1350, cardZoom: 1.85 },
  story: { width: 1080, height: 1920, cardZoom: 2.3 },
};

// The resting pose the export freezes every card in: tilted toward the
// upper right with the light partly on — enough for the foil and glare to
// read in a still, not so much that the NE8 pattern stamps over the photo.
const POSTER_POSE = { x: 0.42, y: -0.3, light: 0.5 };

// A complete, self-contained HTML document for one Instagram graphic — no
// network requests, so it renders the same anywhere. `cardCss` is card.css's
// text and `fontCss` @font-face rules (both inlined by the caller), and
// photo/logo sources should be data: URIs.
export function posterHtml({
  format,
  card,
  cardCss,
  fontCss = "",
  logoSrc,
  siteName = "Poland Seminary Bulldogs",
  siteUrl = "polandathletics.com",
}) {
  const size = POSTER_FORMATS[format];
  if (!size) throw new Error(`Unknown poster format "${format}"`);
  const meta = honorMeta(card.honor);
  // The school's name is already in the footer, so without a logo the
  // header simply has none, rather than repeating it.
  const brand = logoSrc ? `<img class="poster__logo" src="${escapeHtml(logoSrc)}" alt="" />` : "";
  const cardMarkup = cardHtml({
    ...card,
    intro: false,
    lazy: false,
    teamHref: undefined,
    style: poseStyle(POSTER_POSE),
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
${fontCss}
${cardCss}
html, body { margin: 0; padding: 0; background: #060a18; }
* { box-sizing: border-box; }
.poster {
  --accent: ${meta.accent};
  --glow: ${meta.color};
  position: relative;
  width: ${size.width}px;
  height: ${size.height}px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: #fff;
  font-family: "Inter", system-ui, sans-serif;
  background:
    radial-gradient(ellipse 62% 44% at 50% 54%, color-mix(in srgb, var(--accent), transparent 72%) 0%, color-mix(in srgb, var(--glow), transparent 55%) 38%, transparent 72%),
    radial-gradient(circle at 85% 0%, rgba(0, 50, 143, 0.55) 0%, transparent 45%),
    linear-gradient(165deg, #0b1a44 0%, #070c1f 55%, #04060f 100%);
}
.poster::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.11) 1.5px, transparent 1.5px);
  background-size: 34px 34px;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, transparent 38%, transparent 70%, #000 100%);
  mask-image: linear-gradient(to bottom, #000 0%, transparent 38%, transparent 70%, #000 100%);
}
.poster__watermark {
  position: absolute;
  left: 50%;
  top: 54%;
  transform: translate(-50%, -50%);
  font-size: ${format === "story" ? 640 : 540}px;
  font-weight: 900;
  letter-spacing: -0.06em;
  line-height: 1;
  color: transparent;
  -webkit-text-stroke: 3px rgba(255, 255, 255, 0.07);
  white-space: nowrap;
}
.poster__header, .poster__footer, .poster__stage { position: relative; }
.poster__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 40px;
  padding: ${format === "story" ? "210px 90px 0" : "72px 80px 0"};
}
.poster--story .poster__header { flex-direction: column; align-items: center; text-align: center; gap: 28px; }
.poster--story .poster__logo { order: -1; }
.poster__eyebrow {
  margin: 0 0 14px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: #f5c542;
}
.poster__title {
  margin: 0;
  font-size: ${format === "story" ? 112 : 92}px;
  font-weight: 900;
  line-height: 0.92;
  letter-spacing: -0.03em;
  text-transform: uppercase;
}
.poster__logo { height: ${format === "story" ? 130 : 118}px; width: auto; filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.45)); }
.poster__stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.poster__card {
  width: 360px;
  zoom: ${size.cardZoom};
  filter: drop-shadow(0 30px 40px rgba(0, 0, 0, 0.55));
}
.poster__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 0 80px;
  padding: 30px 0 ${format === "story" ? "250px" : "64px"};
  border-top: 2px solid rgba(255, 255, 255, 0.14);
  font-size: 24px;
}
.poster--story .poster__footer { flex-direction: column; justify-content: center; text-align: center; gap: 10px; margin: 0 90px; }
.poster__school { font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
.poster__url { color: rgba(255, 255, 255, 0.65); font-weight: 600; }
</style>
</head>
<body>
<div class="poster poster--${format}">
  <div class="poster__watermark" aria-hidden="true">NE8</div>
  <header class="poster__header">
    <div>
      <p class="poster__eyebrow">NE8 All-Conference</p>
      <h1 class="poster__title">${escapeHtml(card.seasonLabel)}</h1>
    </div>
    ${brand}
  </header>
  <div class="poster__stage"><div class="poster__card">${cardMarkup}</div></div>
  <footer class="poster__footer">
    <span class="poster__school">${escapeHtml(siteName)}</span>
    <span class="poster__url">${escapeHtml(siteUrl)}</span>
  </footer>
</div>
</body>
</html>`;
}
