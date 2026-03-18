export type PaginatedMeta = {
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginatedMeta;
};

export type PaginationInput = {
  page?: number;
  limit?: number;
};

export type ResolvedPagination = {
  page: number;
  limit: number;
  skip: number;
};

export function resolvePagination(input: PaginationInput): ResolvedPagination {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function buildPaginatedResponse<T>(params: {
  data: T[];
  total: number;
  page: number;
  limit: number;
}): PaginatedResponse<T> {
  const { data, total, page, limit } = params;

  return {
    data,
    meta: {
      total,
      page,
      limit,
      hasNext: page * limit < total,
    },
  };
}
