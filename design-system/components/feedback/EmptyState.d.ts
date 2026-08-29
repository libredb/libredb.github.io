import type { ReactNode } from "react";

/** No-content, no-result and error pages. Always states the situation and the next action. */
export interface EmptyStateProps {
  tone?: "neutral" | "brand" | "success" | "error";
  /** 20–24px icon node. Ignored when `code` is set. */
  icon?: ReactNode;
  /** HTTP-style code shown in mono instead of an icon, e.g. "404". */
  code?: string;
  /** What the situation is, in the user's words. */
  title?: string;
  /** Why it happened and what changes it. */
  description?: string;
  /** The one action that resolves the state. */
  action?: ReactNode;
  secondaryAction?: ReactNode;
}

export function EmptyState(props: EmptyStateProps): JSX.Element;
