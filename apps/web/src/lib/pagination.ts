export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};
