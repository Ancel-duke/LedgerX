export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class PaginationUtil {
  static parseParams(page?: number, limit?: number): { skip: number; take: number } {
    const pageNum = page && page > 0 ? page : 1;
    const limitNum = limit && limit > 0 ? limit : 10;
    const skip = (pageNum - 1) * limitNum;

    return { skip, take: limitNum };
  }

  static createMeta(
    page: number,
    limit: number,
    total: number,
  ): PaginationResult<any>['meta'] {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
