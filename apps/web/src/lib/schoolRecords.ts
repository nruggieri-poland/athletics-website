// School records — the CMS's record-books collection
// (apps/cms/src/collections/RecordBooks.ts), one book per sport (two for the
// co-ed sports: Boys and Girls). Feeds /<sport>/records, the /records hub
// and the link on each sport's page.
//
// Only books marked "Show on the website" come back from the API (the CMS
// refuses private ones to anyone not logged in), and only their current
// records — the history stays in the CMS. `currentRecords` is worked out by
// the CMS on save (apps/cms/src/lib/schoolRecords.ts), so the site just
// lays it out. Not to be confused with ./records.ts (win-loss records).

import type { Sport } from "./payload";

const PAYLOAD_URL = import.meta.env.PAYLOAD_URL || "http://localhost:3000";

export interface RecordHolder {
  name: string;
  classOf?: number;
}

export interface RecordPerformance {
  status: "original" | "broken" | "tied";
  holders: RecordHolder[];
  date: string;
  dateSort: string;
  notes?: string;
}

export interface CurrentRecord {
  category: string;
  mark: string;
  performances: RecordPerformance[];
}

export interface RecordBook {
  id: string;
  name: string;
  sport: Sport;
  division?: "Boys" | "Girls";
  currentRecords?: CurrentRecord[] | null;
  updatedAt: string;
}

// Cached for the whole build — every sport page and the hub share one fetch.
// A CMS that can't be reached yields an empty list, so pages just leave
// records out rather than failing the build.
let booksPromise: Promise<RecordBook[]> | null = null;

export function getRecordBooks(): Promise<RecordBook[]> {
  if (!booksPromise) {
    booksPromise = (async () => {
      try {
        const params = new URLSearchParams({ limit: "200", depth: "1" });
        const res = await fetch(`${PAYLOAD_URL}/api/record-books?${params}`);
        if (!res.ok) return [];
        const data = (await res.json()) as { docs: RecordBook[] };
        return data.docs
          .filter((book) => book.sport?.slug && shownRecords(book).length > 0)
          .sort(
            (a, b) =>
              (a.sport.sortOrder ?? 0) - (b.sport.sortOrder ?? 0) ||
              a.sport.name.localeCompare(b.sport.name) ||
              (a.division ?? "").localeCompare(b.division ?? ""),
          );
      } catch {
        return [];
      }
    })();
  }
  return booksPromise;
}

// The records worth showing — a record with no entries yet has no mark.
export const shownRecords = (book: RecordBook): CurrentRecord[] =>
  (book.currentRecords ?? []).filter((record) => record.mark && record.performances.length > 0);

export const recordBookHref = (sportSlug: string) => `/${sportSlug}/records`;

// "Girls Track & Field" for the co-ed sports' books, otherwise the sport.
export const bookTitle = (book: RecordBook) =>
  [book.division, book.sport.name].filter(Boolean).join(" ");

export const classOfLabel = (holder: RecordHolder) =>
  holder.classOf ? `Class of ${holder.classOf}` : "";

// Start of the current OHSAA school year (July 1), as YYYY-MM-DD.
export function schoolYearStart(now = new Date()): string {
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-07-01`;
}

// Set or tied since July 1 — a "New" tag on the page and the hub.
export const isNewThisYear = (record: CurrentRecord, since = schoolYearStart()) =>
  record.performances.some((performance) => performance.dateSort >= since);
