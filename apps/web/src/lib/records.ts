// Win-loss records and "latest results" derived from Game results. Pure
// functions over already-fetched games (no fetching here) so the counting
// rules live in one place and can be tested without a CMS.
import type { Game, GameResult, SeasonType, Team } from "./payload";

export interface Tally {
  wins: number;
  losses: number;
  ties: number;
}

export interface TeamRecord {
  overall: Tally;
  conference: Tally;
}

// What counts toward a W-L record: a real game (not a scrimmage or
// practice) that actually finished with a win, loss, or tie. Meet
// placements (1st/2nd/3rd — track, cross country, invitationals) are not
// head-to-head results, so they never count here. Cancelled/postponed
// games shouldn't carry a result, but they're excluded explicitly anyway.
export function isDecided(game: Game): boolean {
  return (
    game.eventType === "Game" &&
    game.status === "active" &&
    !game.isCancelled &&
    !game.isPostponed &&
    (game.result === "W" || game.result === "L" || game.result === "T")
  );
}

function bump(tally: Tally, result: GameResult | undefined) {
  if (result === "W") tally.wins++;
  else if (result === "L") tally.losses++;
  else if (result === "T") tally.ties++;
}

// null when nothing has been decided yet — callers hide the record rather
// than showing a meaningless 0-0 (preseason, or a sport like cross country
// whose results are all placements).
export function tallyRecord(games: Game[]): TeamRecord | null {
  const record: TeamRecord = {
    overall: { wins: 0, losses: 0, ties: 0 },
    conference: { wins: 0, losses: 0, ties: 0 },
  };
  let decided = 0;
  for (const game of games) {
    if (!isDecided(game)) continue;
    decided++;
    bump(record.overall, game.result);
    if (game.isConferenceGame) bump(record.conference, game.result);
  }
  return decided > 0 ? record : null;
}

export const gamesPlayed = (t: Tally): number => t.wins + t.losses + t.ties;

// "5–2", or "5–2–1" once there's a tie. En dash, not a hyphen.
export function formatTally(t: Tally): string {
  const base = `${t.wins}–${t.losses}`;
  return t.ties > 0 ? `${base}–${t.ties}` : base;
}

// The spoken equivalent of formatTally — "5–2" reads as "5 2" or "5 to 2"
// in a screen reader, which says nothing about wins and losses.
export function describeTally(t: Tally): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [plural(t.wins, "win", "wins"), plural(t.losses, "loss", "losses")];
  if (t.ties > 0) parts.push(plural(t.ties, "tie", "ties"));
  return parts.join(", ");
}

// Which athletic school year a date falls in, as the calendar year it
// starts in (a game on 2026-10-03 and one on 2027-03-12 both return 2026).
// July 1 boundary — mirrors getCurrentSchoolYear in payload.ts, which
// can't be imported here (it reads import.meta.env at load).
export function schoolYearStartYear(dateStr: string): number {
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7)); // 1-12
  return month >= 7 ? year : year - 1;
}

export function seasonLabel(seasonType: SeasonType, startYear: number): string {
  if (seasonType === "Fall") return `Fall ${startYear}`;
  if (seasonType === "Winter") return `Winter ${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`;
  return `Spring ${startYear + 1}`;
}

export interface SeasonRecordRow {
  team: Team;
  record: TeamRecord;
}

export interface SeasonSummary {
  seasonType: SeasonType;
  label: string;
  rows: SeasonRecordRow[];
}

// The homepage "current season" records. "Current" isn't a calendar guess
// — it's whichever season most recently played a varsity game, so it
// flips to Winter the moment the first winter game is played, sits on
// Spring all summer, and never lands on an empty season in the gaps
// between them (the failure mode of fixed date windows). Teams are
// ordered by wins, then fewest losses, then name.
export function summarizeCurrentSeason(completed: Game[]): SeasonSummary | null {
  const varsity = completed.filter(
    (game) => isDecided(game) && game.team?.level === "Varsity" && game.team.isActive !== false && game.team.sport,
  );
  if (varsity.length === 0) return null;

  const latest = varsity.reduce((a, b) => (b.date > a.date ? b : a));
  const seasonType = latest.team.sport.seasonType;
  const startYear = schoolYearStartYear(latest.date);

  const byTeam = new Map<string, { team: Team; games: Game[] }>();
  for (const game of varsity) {
    if (game.team.sport.seasonType !== seasonType || schoolYearStartYear(game.date) !== startYear) continue;
    const key = String(game.team.id);
    const entry = byTeam.get(key) ?? { team: game.team, games: [] };
    entry.games.push(game);
    byTeam.set(key, entry);
  }

  const rows: SeasonRecordRow[] = [];
  for (const { team, games } of byTeam.values()) {
    const record = tallyRecord(games);
    if (record) rows.push({ team, record });
  }
  rows.sort(
    (a, b) =>
      b.record.overall.wins - a.record.overall.wins ||
      a.record.overall.losses - b.record.overall.losses ||
      a.team.sport.name.localeCompare(b.team.sport.name),
  );

  return { seasonType, label: seasonLabel(seasonType, startYear), rows };
}

// Newest first, across every team and level. Anything with a result counts
// — a head-to-head score or a meet placement — so sports that only ever
// post placements still show up.
export function latestResults(completed: Game[], limit = 10): Game[] {
  return completed
    .filter((game) => game.status === "active" && !game.isCancelled && !game.isPostponed && !!game.result && !!game.team?.sport)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time24 ?? "").localeCompare(a.time24 ?? ""))
    .slice(0, limit);
}
