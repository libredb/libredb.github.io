/** Page-by-page navigation for listings and tables. */
export interface PaginationProps {
  /** 1-based current page. */
  page?: number;
  /** Total page count. Collapses to an ellipsis form above 7. */
  total?: number;
  onChange?: (page: number) => void;
}

export function Pagination(props: PaginationProps): JSX.Element;
