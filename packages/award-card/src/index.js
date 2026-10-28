// The NE8 award card on the website: the editor's own finished card artwork
// (designed in Photoshop at 1500×2100, uploaded per athlete in the CMS)
// turned into a reflective trading card — it tilts toward the cursor, a
// glare follows the light, and a holographic foil sweeps across it. The
// foil and glare are clipped to the artwork's own outline (its alpha), so a
// rounded, notched or shield-shaped card reflects only where there's card.
//
// cardHtml() is the markup, card.css the look, engine.js the tilt/light
// motion; apps/web/src/components/awards/AwardCard.astro puts them together.

// Honor wording, order (the order cards are listed in) and foil strength —
// Players/Coaches of the Year shimmer hardest; the three team honors are
// deliberately equal (each has its own foil pattern instead — card.css). `color`/`accent` are for the
// website's own chrome around the cards (honor chips, section dots). Values
// mirror apps/cms/src/lib/awards.ts's HONORS.
export const HONORS = [
  {
    value: "player-of-the-year",
    label: "Player of the Year",
    plural: "Players of the Year",
    short: "POY",
    color: "#00328f",
    accent: "#98d0ff",
    holo: 1,
  },
  {
    value: "coach-of-the-year",
    label: "Coach of the Year",
    plural: "Coaches of the Year",
    short: "COY",
    color: "#00328f",
    accent: "#98d0ff",
    holo: 1,
  },
  {
    value: "first-team",
    label: "First Team",
    plural: "First Team",
    short: "1st Team",
    color: "#2c4fb0",
    accent: "#b7c7ef",
    holo: 0.7,
  },
  {
    value: "second-team",
    label: "Second Team",
    plural: "Second Team",
    short: "2nd Team",
    color: "#3a4256",
    accent: "#cbd5e1",
    holo: 0.7,
  },
  {
    value: "honorable-mention",
    label: "Honorable Mention",
    plural: "Honorable Mention",
    short: "HM",
    color: "#2a2c34",
    accent: "#a7abb8",
    holo: 0.7,
  },
];

// The top honors, which get the premium card: iridescent foil, a light
// sweep that runs on its own, glitter, and a glow — and a bigger spot on
// the page (see isPremium's callers in apps/web).
const PREMIUM = new Set(["player-of-the-year", "coach-of-the-year"]);

export function isPremium(value) {
  return PREMIUM.has(value);
}

export function honorMeta(value) {
  return HONORS.find((honor) => honor.value === value) ?? HONORS[2];
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// One card's markup. Expects card.css on the page; engine.js's
// initAwardCards() brings [data-award-card] elements to life.
//
// `imageSrc` is the finished card artwork, served from the site's own origin
// (CSS masks only load same-origin images, and the foil/glare are masked to
// the artwork's shape). Without one — a card whose artwork isn't uploaded
// yet — a plain placeholder card shows the name and award instead, so a
// season can go live before every card is designed.
export function cardHtml({
  imageSrc,
  width,
  height,
  name,
  award,
  honor,
  intro = true,
  lazy = true,
  lifted = false,
  className = "",
  alt,
}) {
  const meta = honorMeta(honor);
  // The card's accessible name. Callers that print the details in a visible
  // caption next to the card pass a shorter `alt`, so screen readers don't
  // hear everything twice.
  const label = alt ?? [name, award].filter(Boolean).join(", ");
  const classes = [
    "award-card",
    // Picks the foil pattern (card.css): refractor rays for First Team,
    // etched lines for Second Team, ripples for Honorable Mention, and the
    // premium treatment for the "of the Year" honors.
    `award-card--${meta.value}`,
    PREMIUM.has(meta.value) ? "award-card--premium" : "",
    imageSrc ? "award-card--art" : "award-card--placeholder",
    lifted ? "award-card--lifted" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const vars = [
    `--pc-holo: ${meta.holo}`,
    imageSrc ? `--card-image: url("${imageSrc}")` : "",
    // The artwork's own proportions (5:7 for the recommended 1500×2100,
    // but any size works), so it fills the card with nothing letterboxed.
    width && height ? `aspect-ratio: ${width} / ${height}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  const lazyAttrs = lazy ? ' loading="lazy" decoding="async"' : "";

  const face = imageSrc
    ? `<img class="award-card__art" src="${escapeHtml(imageSrc)}"${width && height ? ` width="${width}" height="${height}"` : ""} alt="${escapeHtml(label)}"${lazyAttrs} draggable="false" />`
    : `<div class="award-card__placeholder" role="img" aria-label="${escapeHtml(label)}"><p class="award-card__placeholder-name" aria-hidden="true">${escapeHtml(name)}</p><p class="award-card__placeholder-award" aria-hidden="true">${escapeHtml(award)}</p></div>`;

  return `<div class="${escapeHtml(classes)}" style="${escapeHtml(vars)}" data-award-card data-intro="${intro ? "true" : "false"}">
  <div class="award-card__body">
    ${face}
    <span class="award-card__sheen" aria-hidden="true"></span>
    <span class="award-card__foil" aria-hidden="true"></span>
    <span class="award-card__glare" aria-hidden="true"></span>
    <span class="award-card__shimmer" aria-hidden="true"></span>
    <span class="award-card__sparkle" aria-hidden="true"></span>
  </div>
</div>`;
}
