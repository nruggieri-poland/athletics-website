# Fans & Community page — draft content (pulled 2026-07-20)

The `/resources/fans` page originally shipped with a full set of gameday/ticketing/merch
sections, all filled with placeholder content that was never replaced with anything real
(fabricated promo dates, fabricated pricing, a merch grid with a "no online store yet" note,
and a dead `href="#"` link). Per request, the whole page was stripped down to just a carousel
of Articles tagged "Fans" (see `apps/web/src/pages/resources/fans/index.astro`).

Everything below is preserved verbatim so it can be restored later once there's real content
for it — either paste the page body back into `fans/index.astro` and recreate the component
files under `apps/web/src/components/resources/`, or use this as a reference to rebuild
individual sections.

## Original `apps/web/src/pages/resources/fans/index.astro`

```astro
---
import BaseLayout from "../../../layouts/BaseLayout.astro";
import PageHero from "../../../components/resources/PageHero.astro";
import NextGameSpotlight from "../../../components/resources/NextGameSpotlight.astro";
import AnnouncementBanner from "../../../components/resources/AnnouncementBanner.astro";
import InfoTile from "../../../components/resources/InfoTile.astro";
import LinkList from "../../../components/resources/LinkList.astro";
import PromoStrip from "../../../components/resources/PromoStrip.astro";
import PricingTable from "../../../components/resources/PricingTable.astro";
import MerchGrid from "../../../components/resources/MerchGrid.astro";
import SupportBand from "../../../components/resources/SupportBand.astro";
import { getNextHomeGame, getSiteSettings } from "../../../lib/payload";

const [nextGame, siteSettings] = await Promise.all([getNextHomeGame(), getSiteSettings()]);

const followLinks = [
  { label: "Live Scores & Full Schedule", href: "/calendar" },
  { label: "Watch Live on Hudl", href: "https://www.hudl.com", external: true },
  { label: "Magic Moments Photography", href: "#", external: true },
];

const promos = [
  { date: "Sep 11", sport: "Football", name: "Youth Night", description: "Free admission for K–6, meet the team pregame." },
  { date: "Oct 2", sport: "Football", name: "Pink Out", description: "Breast cancer awareness night — proceeds benefit local families." },
  { date: "Oct 17", sport: "Football", name: "Senior Night", description: "Pregame recognition for every senior athlete." },
  { date: "Nov 3", sport: "Volleyball", name: "Teacher Appreciation", description: "PSHS staff get in free with a school ID." },
];

const plans = [
  { name: "Adult Season Pass", covers: "All home events, all sports", price: "$60" },
  { name: "Student Season Pass", covers: "All home events, all sports", price: "$35" },
  { name: "Family Pass (up to 5)", covers: "All home events, all sports", price: "$150" },
];

const merch = [
  { name: "Bulldogs Tee", price: "$18" },
  { name: "Pullover Hoodie", price: "$38" },
  { name: "Snapback Hat", price: "$22" },
  { name: "Rally Towel", price: "$8" },
];
---

<BaseLayout title="For Fans & Community" description="Tickets, gameday info, and ways to support Poland Seminary Bulldogs Athletics">
  <div class="mx-auto max-w-content px-6">
    <PageHero
      section="Fans & Community"
      title="For Fans & Community"
      lede="Tickets, gameday logistics, and ways to support the Bulldogs year-round."
    />

    <div class="space-y-14 py-14">
      <section>
        <NextGameSpotlight game={nextGame} />
      </section>

      <section>
        <AnnouncementBanner
          title="Weather delays & cancellations"
          body="Posted here and to the team's calendar as soon as a call is made — no need to call the office."
        />
      </section>

      <section>
        <h2 class="mb-5 text-h3 font-bold text-ink-900">Gameday guide</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <InfoTile
            label="Parking"
            value="Free lot off Rt. 224"
            sub="Overflow lot opens for football & playoffs."
            iconPath="M5 16V6a1 1 0 0 1 1-1h5.5a3.5 3.5 0 1 1 0 7H6m9 4v-4"
          />
          <InfoTile
            label="Admission"
            value="$6 adults · $4 students"
            sub="Season passes at the athletic office."
            iconPath="M4 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1a1.5 1.5 0 0 0 0 3v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1a1.5 1.5 0 0 0 0-3V8Z"
          />
          <InfoTile
            label="Bag policy"
            value={`Clear bags only, 12" × 6" × 12"`}
            sub="Gates open 1 hour before kickoff."
            iconPath="M6 8V6a4 4 0 1 1 8 0v2m-9 0h10l.7 8.5a1.5 1.5 0 0 1-1.5 1.5H5.8a1.5 1.5 0 0 1-1.5-1.5L5 8Z"
          />
          <InfoTile
            label="Directions"
            value="Bulldog Stadium"
            sub={siteSettings.address ?? "142 Bulldog Way, Poland, OH 44514"}
            iconPath="M10 17.5s5.5-5 5.5-9a5.5 5.5 0 1 0-11 0c0 4 5.5 9 5.5 9Zm0-7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
          />
        </div>
      </section>

      <section>
        <h2 class="mb-1 text-h3 font-bold text-ink-900">Follow along</h2>
        <LinkList links={followLinks} />
      </section>

      <section>
        <h2 class="mb-1 text-h3 font-bold text-ink-900">Theme nights this season</h2>
        <p class="mb-4 text-sm text-ink-500">Scroll for what's coming up &rarr;</p>
        <PromoStrip promos={promos} />
      </section>

      <section>
        <h2 class="mb-5 text-h3 font-bold text-ink-900">Season tickets & memberships</h2>
        <PricingTable plans={plans} contactEmail="athletics@polandbulldogs.org" />
      </section>

      <section>
        <h2 class="mb-5 text-h3 font-bold text-ink-900">Spirit store</h2>
        <MerchGrid items={merch} />
        <p class="mt-3 text-xs text-ink-500">
          No online store yet — this section is a placeholder for one. In the meantime, contact the
          <a href="mailto:athletics@polandbulldogs.org?subject=Spirit%20Wear" class="font-semibold text-primary-600 hover:text-primary-700">athletic office</a>.
        </p>
      </section>

      <section>
        <SupportBand
          title="Support the Bulldogs year-round"
          body="Booster Club membership funds equipment, transportation, and senior-night gifts across every sport."
          ctaLabel="Contact the Booster Club"
          ctaHref="mailto:athletics@polandbulldogs.org?subject=Booster%20Club"
        />
      </section>
    </div>
  </div>
</BaseLayout>
```

## `NextGameSpotlight.astro`

```astro
---
import type { Game } from "../../lib/payload";
import { levelSlug } from "../../lib/payload";

interface Props {
  game: Game | null;
}

const { game } = Astro.props;

const dateObj = game ? new Date(`${game.date.slice(0, 10)}T00:00:00`) : null;
const formattedDate = dateObj?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const timeLabel = game && (game.isTimeTBD || !game.time) ? "Time TBD" : game?.time;
const daysAway = dateObj
  ? Math.round((dateObj.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  : null;
---

{game ? (
  <div class="flex flex-wrap items-center justify-between gap-8 rounded-2xl bg-primary-900 p-10 text-white">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wide text-primary-200">
        Next home game{daysAway !== null && daysAway >= 0 ? ` · ${daysAway === 0 ? "today" : `${daysAway} day${daysAway === 1 ? "" : "s"} away`}` : ""}
      </p>
      <h1 class="mt-2 text-3xl font-extrabold">
        {game.team.sport.name} vs. {game.opponentName}
      </h1>
      <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
        <span><strong class="text-white">{formattedDate}</strong> &middot; {timeLabel}</span>
        {game.location && <span>{game.location}</span>}
      </div>
    </div>
    <div class="flex flex-wrap gap-3">
      <a
        href={`/${game.team.sport.slug}/${levelSlug(game.team.level)}`}
        class="rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary-800 hover:bg-primary-50"
      >
        Full schedule
      </a>
      <a
        href="/calendar"
        class="rounded-lg border-[1.5px] border-white/70 px-4.5 py-2.5 text-sm font-bold text-white hover:bg-white/10"
      >
        View calendar
      </a>
    </div>
  </div>
) : (
  <div class="rounded-2xl bg-ink-50 p-10 text-center">
    <p class="text-sm font-semibold uppercase tracking-wide text-ink-500">Next home game</p>
    <p class="mt-2 text-lg font-semibold text-ink-900">Nothing scheduled right now — check back soon.</p>
    <a href="/calendar" class="mt-3 inline-block text-sm font-semibold text-primary-600 hover:text-primary-700">
      View the full calendar &rarr;
    </a>
  </div>
)}
```

## `AnnouncementBanner.astro`

```astro
---
interface Props {
  title: string;
  body: string;
}

const { title, body } = Astro.props;
---

<div class="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 px-5 py-4">
  <svg class="mt-0.5 h-5 w-5 shrink-0 text-primary-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M10 6v4.5m0 3.25h.01M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  <div>
    <p class="text-sm font-semibold text-primary-900">{title}</p>
    <p class="mt-0.5 text-sm text-primary-800">{body}</p>
  </div>
</div>
```

## `InfoTile.astro`

```astro
---
interface Props {
  label: string;
  value: string;
  sub: string;
  iconPath: string;
}

const { label, value, sub, iconPath } = Astro.props;
---

<div class="flex items-start gap-3.5 rounded-xl border border-ink-100 p-5">
  <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700">
    <svg class="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d={iconPath} stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </span>
  <div>
    <p class="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
    <p class="mt-1 text-sm font-semibold leading-snug text-ink-900">{value}</p>
    <p class="mt-0.5 text-xs text-ink-500">{sub}</p>
  </div>
</div>
```

## `LinkList.astro`

```astro
---
interface LinkItem {
  label: string;
  href: string;
  external?: boolean;
}

interface Props {
  links: LinkItem[];
}

const { links } = Astro.props;
---

<ul class="flex flex-col">
  {links.map((link) => (
    <li>
      <a
        href={link.href}
        target={link.external ? "_blank" : undefined}
        rel={link.external ? "noopener noreferrer" : undefined}
        class="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm font-semibold text-ink-900 hover:bg-ink-50"
      >
        <svg class="h-3.5 w-3.5 shrink-0 text-ink-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M8 12l4-4m-3-2h4a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-1m-4 0H7a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2h1" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {link.label}
      </a>
    </li>
  ))}
</ul>
```

## `PromoStrip.astro`

```astro
---
interface Promo {
  date: string;
  sport: string;
  name: string;
  description: string;
}

interface Props {
  promos: Promo[];
}

const { promos } = Astro.props;
---

<div class="flex gap-3.5 overflow-x-auto pb-2">
  {promos.map((promo) => (
    <div class="w-56 shrink-0 rounded-xl border border-ink-100 bg-surface p-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-ink-500">{promo.date} &middot; {promo.sport}</p>
      <p class="mt-1.5 text-sm font-bold text-ink-900">{promo.name}</p>
      <p class="mt-1 text-xs text-ink-600">{promo.description}</p>
    </div>
  ))}
</div>
```

## `PricingTable.astro`

```astro
---
interface Plan {
  name: string;
  covers: string;
  price: string;
}

interface Props {
  plans: Plan[];
  contactEmail: string;
}

const { plans, contactEmail } = Astro.props;
---

<div class="overflow-x-auto rounded-xl border border-ink-100">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
        <th class="px-4 py-3">Pass</th>
        <th class="px-4 py-3">Covers</th>
        <th class="px-4 py-3">Price</th>
      </tr>
    </thead>
    <tbody>
      {plans.map((plan) => (
        <tr class="border-b border-ink-100 last:border-0">
          <td class="px-4 py-3 font-semibold text-ink-900">{plan.name}</td>
          <td class="px-4 py-3 text-ink-600">{plan.covers}</td>
          <td class="px-4 py-3 font-semibold tabular-nums text-ink-900">{plan.price}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
<p class="mt-3 text-xs text-ink-500">
  To purchase a season pass, contact the athletic office at
  <a href={`mailto:${contactEmail}`} class="font-semibold text-primary-600 hover:text-primary-700"> {contactEmail}</a>.
</p>
```

## `MerchGrid.astro`

```astro
---
interface Item {
  name: string;
  price: string;
}

interface Props {
  items: Item[];
}

const { items } = Astro.props;
---

<div class="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
  {items.map((item) => (
    <div class="rounded-xl border border-ink-100 p-4">
      <div class="aspect-square rounded-lg bg-primary-50"></div>
      <p class="mt-2.5 text-sm font-semibold text-ink-900">{item.name}</p>
      <p class="text-xs tabular-nums text-ink-500">{item.price}</p>
    </div>
  ))}
</div>
```

## `SupportBand.astro`

```astro
---
interface Props {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

const { title, body, ctaLabel, ctaHref } = Astro.props;
---

<div class="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-primary-600 px-9 py-8 text-white">
  <div>
    <h2 class="text-xl font-extrabold">{title}</h2>
    <p class="mt-1 max-w-[46ch] text-sm text-white/85">{body}</p>
  </div>
  <a href={ctaHref} class="shrink-0 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary-700 hover:bg-primary-50">
    {ctaLabel}
  </a>
</div>
```
