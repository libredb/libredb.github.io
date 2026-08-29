import type { ReactNode, MouseEventHandler } from "react";

/** Pill-shaped keyword, filter chip or removable selection. */
export interface TagProps {
  /** Renders as a button with hover feedback even without onClick. */
  interactive?: boolean;
  /** Filter-chip selected state — brand tint, no border. */
  selected?: boolean;
  /** Adds a × affordance. Provide only when the user can remove the value. */
  onRemove?: MouseEventHandler<HTMLElement>;
  onClick?: MouseEventHandler<HTMLElement>;
  children?: ReactNode;
}

export function Tag(props: TagProps): JSX.Element;
