import type { ReactNode } from "react";

export interface AccordionItem {
  /** The question, sentence case, ending in a question mark for FAQ use. */
  question: string;
  answer: ReactNode;
}

/** Collapsible list. The canonical FAQ component. */
export interface AccordionProps {
  items?: AccordionItem[];
  /** Index open on mount. Pass null for all closed. */
  defaultOpen?: number | null;
  /** Allow several panels open at once. Default false. */
  allowMultiple?: boolean;
}

export function Accordion(props: AccordionProps): JSX.Element;
