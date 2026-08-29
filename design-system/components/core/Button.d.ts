import type { ReactNode, MouseEventHandler } from "react";

/**
 * The system's action primitive. One primary button per screen.
 *
 * @startingPoint section="Core" subtitle="Eight variants, three sizes, full state matrix" viewport="700x220"
 */
export interface ButtonProps {
  /** Visual role. `primary` is the single conversion action on a screen. */
  variant?: "primary" | "secondary" | "outline" | "tertiary" | "ghost" | "destructive" | "inverse" | "link";
  /** s = 36px, m = 44px (default, meets the 44px touch target), l = 52px. */
  size?: "s" | "m" | "l";
  /** Leading icon node — 20px, currentColor. */
  iconLeft?: ReactNode;
  /** Trailing icon node — 20px, or the unicode arrow used as type. */
  iconRight?: ReactNode;
  /** Swaps the leading icon for a spinner, sets aria-busy and keeps the label. */
  loading?: boolean;
  disabled?: boolean;
  /** Mobile primary actions are full width. */
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Action + object, sentence case: "Teklif al", never "Gönder". */
  children?: ReactNode;
}

export function Button(props: ButtonProps): JSX.Element;
