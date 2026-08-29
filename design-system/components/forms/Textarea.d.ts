import type { TextareaHTMLAttributes } from "react";

/** Multi-line text control. Vertical resize only. */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea(props: TextareaProps): JSX.Element;
