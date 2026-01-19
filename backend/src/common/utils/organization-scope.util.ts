import { Prisma } from '@prisma/client';

export class OrganizationScopeUtil {
  static addOrganizationScope(
    organizationId: string,
    where?: Prisma.JsonObject,
  ): Prisma.JsonObject {
    return {
      ...where,
      organizationId,
    };
  }

  static ensureOrganizationScope(organizationId: string, data: any): any {
    return {
      ...data,
      organizationId,
    };
  }
}
