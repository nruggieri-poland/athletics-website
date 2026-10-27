export type HonorValue =
  "player-of-the-year" | "coach-of-the-year" | "first-team" | "second-team" | "honorable-mention";

export interface HonorMeta {
  value: HonorValue;
  label: string;
  plural: string;
  short: string;
  color: string;
  accent: string;
  holo: number;
}

export const HONORS: HonorMeta[];
export function honorMeta(value: HonorValue): HonorMeta;

export interface CardProps {
  name: string;
  honor: HonorValue;
  honorText?: string;
  sportLabel: string;
  statusText?: string;
  year: string;
  seasonLabel: string;
  photoSrc?: string;
  photoPosition?: string;
  teamHref?: string;
  intro?: boolean;
  lazy?: boolean;
  className?: string;
  style?: string;
}

export function cardHtml(props: CardProps): string;
export function poseStyle(pose?: { x?: number; y?: number; light?: number; tilt?: number; parallax?: number }): string;

export type PosterFormat = "feed" | "story";
export const POSTER_FORMATS: Record<PosterFormat, { width: number; height: number; cardZoom: number }>;

export function posterHtml(options: {
  format: PosterFormat;
  card: CardProps;
  cardCss: string;
  fontCss?: string;
  logoSrc?: string;
  siteName?: string;
  siteUrl?: string;
}): string;
