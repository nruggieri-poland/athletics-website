// NE8 championships won by Poland Seminary teams — the CMS's
// ne8-championships collection (apps/cms/src/collections/NE8Championships.ts),
// one entry per title. Feeds /ne8/champions, the NE8 block on each sport's
// page, and the /ne8 page.

import type { Media, Sport } from "./payload";

const PAYLOAD_URL = import.meta.env.PAYLOAD_URL || "http://localhost:3000";

export type ChampionshipTitle = "champions" | "co-champions" | "tournament-champions";

export interface Championship {
  id: string;
  sport: Sport;
  schoolYear: string;
  title: ChampionshipTitle;
  division?: "Boys" | "Girls";
  record?: string;
  teamPhoto?: Media;
}

export const TITLE_LABELS: Record<ChampionshipTitle, string> = {
  champions: "NE8 Champions",
  "co-champions": "NE8 Co-Champions",
  "tournament-champions": "NE8 Tournament Champions",
};

// "Girls Cross Country" for the coed sports' entries, otherwise the sport.
export function championshipTeam(championship: Championship): string {
  return [championship.division, championship.sport.name].filter(Boolean).join(" ");
}

// "2024-25" — the short form used in lists of years.
export function shortSchoolYear(schoolYear: string): string {
  return schoolYear.replace(/^(\d{4})-\d{2}(\d{2})$/, "$1-$2");
}

// Every championship, newest school year first, then in the sports' own
// order. One fetch per build (cached); an unreachable CMS gives an empty
// list so pages just leave championships out.
let championshipsPromise: Promise<Championship[]> | null = null;

export function getChampionships(): Promise<Championship[]> {
  if (!championshipsPromise) {
    championshipsPromise = (async () => {
      try {
        const params = new URLSearchParams({ limit: "500", depth: "1" });
        const res = await fetch(`${PAYLOAD_URL}/api/ne8-championships?${params}`);
        if (!res.ok) return [];
        const data = (await res.json()) as { docs: Championship[] };
        return data.docs
          .filter((championship) => championship.sport?.slug)
          .sort(
            (a, b) =>
              b.schoolYear.localeCompare(a.schoolYear) ||
              (a.sport.sortOrder ?? 0) - (b.sport.sortOrder ?? 0) ||
              championshipTeam(a).localeCompare(championshipTeam(b)),
          );
      } catch {
        return [];
      }
    })();
  }
  return championshipsPromise;
}

export function championshipsForSport(
  championships: Championship[],
  sportSlug: string,
): Championship[] {
  return championships.filter((championship) => championship.sport.slug === sportSlug);
}

export interface ChampionshipYear {
  schoolYear: string;
  championships: Championship[];
}

export function groupChampionshipsByYear(championships: Championship[]): ChampionshipYear[] {
  const groups = new Map<string, Championship[]>();
  for (const championship of championships) {
    groups.set(championship.schoolYear, [
      ...(groups.get(championship.schoolYear) ?? []),
      championship,
    ]);
  }
  return [...groups.entries()].map(([schoolYear, list]) => ({ schoolYear, championships: list }));
}
