import type { ReactNode } from "react";

/**
 * Inline, persistent message tied to the content around it.
 *
 * @startingPoint section="Feedback" subtitle="Alert, toast, dialog, tooltip, accordion, loading, empty" viewport="700x360"
 */
export interface AlertProps {
  tone?: "info" | "success" | "warning" | "error";
  /** One-line summary in sentence case. */
  title?: string;
  /** Resolution action, usually a small outline Button in the alert's own colour. */
  action?: ReactNode;
  /** Provide only when dismissing loses nothing. Errors are not dismissible. */
  onDismiss?: () => void;
  /** Body: what happened and what to do. */
  children?: ReactNode;
}

export function Alert(props: AlertProps): JSX.Element;
