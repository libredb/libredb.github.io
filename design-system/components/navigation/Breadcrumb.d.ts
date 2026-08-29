export interface BreadcrumbItem {
  label: string;
  /** Omit on the final item — the current page is never a link. */
  href?: string;
}

/** Shows where the user is in the hierarchy. Required on every page below the top level. */
export interface BreadcrumbProps {
  items?: BreadcrumbItem[];
}

export function Breadcrumb(props: BreadcrumbProps): JSX.Element;
