import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";

/**
 * @permission authenticated
 * @role client|developer|admin
 * @resource dashboard
 */
export async function GET() {
  try {
    const actor = await getAuthUser();

    const [projectCount, bidCount, pendingCertificationCount, escrowAgg] = await Promise.all([
      prisma.project.count({
        where: {
          deletedAt: null,
          status: { in: ["PUBLISHED", "BIDDING", "AWARDED"] },
          ...(actor.role === "CLIENT"
            ? { clientId: actor.userId }
            : actor.role === "DEVELOPER"
              ? {
                  bids: {
                    some: {
                      developerId: actor.userId,
                      deletedAt: null
                    }
                  }
                }
              : {})
        }
      }),
      prisma.bid.count({
        where: {
          deletedAt: null,
          status: "PENDING",
          ...(actor.role === "DEVELOPER" ? { developerId: actor.userId } : {})
        }
      }),
      prisma.certification.count({
        where: {
          deletedAt: null,
          status: "PENDING"
        }
      }),
      prisma.escrowOrder.aggregate({
        _sum: { amount: true },
        where: {
          deletedAt: null,
          status: { in: ["PAID", "RELEASED"] }
        }
      })
    ]);

    return ok(
      {
        activeProjects: projectCount,
        activeBids: bidCount,
        pendingCertifications: pendingCertificationCount,
        escrowTotalAmount: escrowAgg._sum.amount?.toString() ?? "0.00"
      },
      200
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
