import type { ReactNode } from "react";

/** Transient confirmation, bottom-right, max three at once. */
export interface ToastProps {
  tone?: "info" | "success" | "warning" | "error";
  /** Replaces the icon with a spinner for in-flight work. */
  loading?: boolean;
  /** Retry or undo affordance, usually a link Button. */
  action?: ReactNode;
  onDismiss?: () => void;
  children?: ReactNode;
}

export function Toast(props: ToastProps): JSX.Element;
