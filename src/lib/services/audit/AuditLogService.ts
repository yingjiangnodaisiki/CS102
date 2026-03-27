import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface AuditLogInput {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: "SUCCESS" | "FAILED";
  requestIp?: string | null;
  requestDevice?: string | null;
  details?: Prisma.InputJsonValue;
}

export class AuditLogService {
  static async record(input: AuditLogInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        status: input.status,
        requestIp: input.requestIp ?? null,
        requestDevice: input.requestDevice ?? null,
        details: input.details
      }
    });
  }
}
