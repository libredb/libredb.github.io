export interface TabItem {
  value: string;
  label: string;
}

/**
 * Switches between sibling views of the same object.
 *
 * @startingPoint section="Navigation" subtitle="Tabs, breadcrumb and pagination" viewport="700x260"
 */
export interface TabsProps {
  items?: Array<TabItem | string>;
  /** Controlled active value. Falls back to the first item. */
  value?: string;
  /** underline = default page tabs · pills = filter context · contained = 2-way toggle. */
  variant?: "underline" | "pills" | "contained";
  onChange?: (value: string) => void;
}

export function Tabs(props: TabsProps): JSX.Element;
