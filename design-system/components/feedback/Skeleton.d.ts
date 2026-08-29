/** Shape-matched loading placeholder. Mirrors the real content's dimensions. */
export interface SkeletonProps {
  variant?: "text" | "media" | "circle";
  /** CSS width. Text lines get a natural ragged default when omitted. */
  width?: number | string;
  height?: number | string;
  /** Number of text lines. Default 3. */
  lines?: number;
  /** Aspect ratio for the media variant, e.g. "16 / 9". */
  ratio?: string;
}

export function Skeleton(props: SkeletonProps): JSX.Element;
