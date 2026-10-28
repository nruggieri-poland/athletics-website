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
export function isPremium(value: HonorValue): boolean;

export interface CardProps {
  imageSrc?: string;
  width?: number;
  height?: number;
  name: string;
  award: string;
  honor: HonorValue;
  intro?: boolean;
  lazy?: boolean;
  lifted?: boolean;
  className?: string;
}

export function cardHtml(props: CardProps): string;
