import type { ReactNode, InputHTMLAttributes } from "react";

/**
 * Single-line text control. Always pair with FormField — no bare inputs.
 *
 * @startingPoint section="Forms" subtitle="Input, select and choice controls in every state" viewport="700x340"
 */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** m = 44px (default), l = 52px for hero/landing forms. */
  size?: "m" | "l";
  /** Error state — red border, tinted ground, aria-invalid. */
  invalid?: boolean;
  /** Confirmed-valid state — green border only, no tint. */
  valid?: boolean;
  /** Leading 17px icon inside the field. */
  iconLeft?: ReactNode;
  /** Static leading segment, e.g. "https://". */
  prefix?: ReactNode;
  /** Static trailing segment, e.g. ".com.tr". */
  suffix?: ReactNode;
  /** Trailing control inside the field, e.g. a show/hide password button. */
  action?: ReactNode;
}

export function Input(props: InputProps): JSX.Element;
