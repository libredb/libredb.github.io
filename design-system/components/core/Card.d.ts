import type { ReactNode, MouseEventHandler, ElementType } from "react";

/**
 * The shared card shell: hairline border, 12px radius, 24px padding, no resting shadow.
 *
 * @startingPoint section="Core" subtitle="Card shell with media, tones and hover lift" viewport="700x300"
 */
export interface CardProps {
  /** Override the element. Defaults to `a` when onClick is passed, otherwise `div`. */
  as?: ElementType;
  /** Enables the −4px hover lift + shadow.l without needing an onClick. */
  interactive?: boolean;
  /** Selected state — brand border and a resting shadow. */
  selected?: boolean;
  /** Full-bleed media placed above the padded body, usually a `CardMedia`. */
  media?: ReactNode;
  padding?: "comfortable" | "compact";
  /** `brand` and `inverse` are for CTA cards only, one per view. */
  tone?: "surface" | "subtle" | "brand" | "inverse";
  onClick?: MouseEventHandler<HTMLElement>;
  children?: ReactNode;
}

export interface CardMediaProps {
  /** CSS aspect-ratio string, e.g. "16 / 9", "4 / 3", "1". */
  ratio?: string;
  src?: string;
  /** Placeholder caption naming what belongs there, e.g. "product shot 16:9". */
  caption?: string;
  children?: ReactNode;
}

export function Card(props: CardProps): JSX.Element;
export function CardMedia(props: CardMediaProps): JSX.Element;
