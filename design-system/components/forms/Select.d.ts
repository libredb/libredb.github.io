import type { SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Native single-select with system chrome. For 6+ options prefer a searchable pattern. */
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options?: Array<SelectOption | string>;
  /** Disabled first option — never carries information. */
  placeholder?: string;
  invalid?: boolean;
}

export function Select(props: SelectProps): JSX.Element;
