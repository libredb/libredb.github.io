import type { ReactNode, ChangeEventHandler } from "react";

/** Multi-select boolean control with an inline label. */
export interface CheckboxProps {
  checked?: boolean;
  /** Parent-of-partial-selection state — renders a dash, not a tick. */
  indeterminate?: boolean;
  disabled?: boolean;
  /** Error state, e.g. an unticked mandatory consent box. */
  invalid?: boolean;
  /** Inline label. Rich nodes are allowed for consent copy with links. */
  label?: ReactNode;
  id?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}

export function Checkbox(props: CheckboxProps): JSX.Element;
