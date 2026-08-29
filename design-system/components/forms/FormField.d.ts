import type { ReactNode } from "react";

/** Label + required marker + control + helper/error wrapper. Labels are always visible. */
export interface FormFieldProps {
  /** Visible label. Never replace it with a placeholder. */
  label?: string;
  /** id of the control inside — wires label and aria-describedby. */
  htmlFor?: string;
  /** Marks the field required. Only required fields are marked, never optional ones. */
  required?: boolean;
  /** Neutral guidance shown under the control. */
  helper?: string;
  /** Error message: what happened + how to fix it. Replaces helper and colours the row. */
  error?: string;
  /** Success confirmation, e.g. "Alan adı müsait". */
  success?: string;
  /** Right-aligned mono counter, e.g. "120 / 500". */
  counter?: string;
  /** The control, or a render function receiving { id, aria-describedby, invalid }. */
  children?: ReactNode | ((bag: { id?: string; invalid: boolean }) => ReactNode);
}

export function FormField(props: FormFieldProps): JSX.Element;
