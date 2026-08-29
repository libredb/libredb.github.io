import type { ReactNode } from "react";

/** Short label on hover AND keyboard focus. Never holds interactive content. */
export interface TooltipProps {
  /** A few words, set in mono. No sentences, no links. */
  label: string;
  placement?: "top" | "bottom" | "left" | "right";
  children?: ReactNode;
}

export function Tooltip(props: TooltipProps): JSX.Element;
