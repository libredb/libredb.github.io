import type { ChangeEventHandler } from "react";

/** Immediate on/off setting. Applies at once — never needs a Save button. */
export interface SwitchProps {
  checked?: boolean;
  disabled?: boolean;
  /** What the setting does, stated positively. */
  label?: string;
  /** Consequence of turning it on, one line. */
  description?: string;
  id?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}

export function Switch(props: SwitchProps): JSX.Element;
