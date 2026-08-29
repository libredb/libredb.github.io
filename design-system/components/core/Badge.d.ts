import type { ReactNode } from "react";

/** Small non-interactive status or category marker. */
export interface BadgeProps {
  tone?: "neutral" | "primary" | "success" | "warning" | "error" | "info" | "brand";
  /** Adds a 6px leading dot — use for live/health status. */
  dot?: boolean;
  children?: ReactNode;
}

export function Badge(props: BadgeProps): JSX.Element;
