import type { ReactNode, MouseEventHandler } from "react";

/** Icon-only control. `label` is required — it becomes aria-label. */
export interface IconButtonProps {
  /** Required accessible name, e.g. "Kapat", "Ayarlar". */
  label: string;
  /** 20px icon node, currentColor. */
  icon?: ReactNode;
  variant?: "filled" | "outline" | "ghost";
  shape?: "square" | "circle";
  /** s = 36, m = 44 (default), l = 52. Never below 44 on touch surfaces. */
  size?: "s" | "m" | "l";
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function IconButton(props: IconButtonProps): JSX.Element;
