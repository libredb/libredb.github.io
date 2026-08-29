import type { ReactNode } from "react";

/** Person or account marker: photo, Turkish-safe initials, or an icon. */
export interface AvatarProps {
  /** Full name — drives the initials and the accessible label. */
  name?: string;
  /** Photo URL. Falls back to initials when absent. */
  src?: string;
  /** Icon node used instead of initials for non-person accounts. */
  icon?: ReactNode;
  size?: "xs" | "s" | "m" | "l" | "xl";
  status?: "online" | "offline" | "busy" | "away";
  /** Gradient used behind initials. */
  tone?: "brand" | "data";
}

export interface AvatarGroupProps {
  children?: ReactNode;
  /** How many avatars to render before the +N chip. Default 4. */
  max?: number;
  /** Real total, when it is larger than the children passed. */
  total?: number;
}

export function Avatar(props: AvatarProps): JSX.Element;
export function AvatarGroup(props: AvatarGroupProps): JSX.Element;
