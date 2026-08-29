import type { ReactNode, ChangeEventHandler } from "react";

/** One choice from a small mutually exclusive set. Always inside a group with a shared `name`. */
export interface RadioProps {
  checked?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  /** Secondary line under the label, e.g. "%20 indirim". */
  description?: string;
  name?: string;
  value?: string;
  id?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}

export function Radio(props: RadioProps): JSX.Element;
