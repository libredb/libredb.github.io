/** Indeterminate loading indicator. */
export interface SpinnerProps {
  /** s = 16 (inline), m = 24 (default), l = 36 (section). */
  size?: "s" | "m" | "l";
  /** Accessible label, default "Yükleniyor". */
  label?: string;
  /** `inverse` for use on a filled button or dark surface. */
  tone?: "brand" | "inverse";
}

/** Determinate progress, 0–100. */
export interface ProgressBarProps {
  value?: number;
  label?: string;
  tone?: "brand" | "data";
  showValue?: boolean;
}

export function Spinner(props: SpinnerProps): JSX.Element;
export function ProgressBar(props: ProgressBarProps): JSX.Element;
