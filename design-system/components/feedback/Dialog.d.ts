import type { ReactNode } from "react";

/** Modal that blocks the page. Traps focus, closes on Escape and on backdrop click. */
export interface DialogProps {
  open?: boolean;
  /** s = 400, m = 520 (default), l = 680. */
  size?: "s" | "m" | "l";
  /** Adds a coloured glyph above the title. `destructive` for irreversible actions. */
  tone?: "default" | "destructive" | "warning" | "success";
  title?: string;
  /** One or two sentences naming the consequence. */
  description?: string;
  /** Action row — cancel on the left, the committing action on the right. */
  footer?: ReactNode;
  onClose?: () => void;
  /** Body content: a confirmation input, a form, media. */
  children?: ReactNode;
}

export function Dialog(props: DialogProps): JSX.Element | null;
