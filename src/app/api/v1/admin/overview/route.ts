import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { AppError } from "@/lib/errors/AppError";
import { fail, ok } from "@/lib/utils/api-response";

/**
 * @permission authenticated
 * @role admin
 * @resource admin
 */
export async function GET() {
  try {
    const actor = await getAuthUser();
    if (actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "仅管理员可访问管理总览", 403);
    }

    const [
      pendingRiskEvents,
      pendingReviewCases,
      pendingDisputes,
      pendingCertifications,
      pendingWorkspaceSubmissions,
      awardedProjects,
      latestRiskEvents,
      latestReviewCases,
      latestDisputes,
      latestWorkspaceSubmissions
    ] = await Promise.all([
      prisma.riskEvent.count({
        where: {
          deletedAt: null,
          status: {
            in: ["OPEN", "IN_REVIEW"]
          }
        }
      }),
      prisma.adminReviewCase.count({
        where: {
          deletedAt: null,
          status: "PENDING"
        }
      }),
      prisma.disputeCase.count({
        where: {
          deletedAt: null,
          status: {
            in: ["REQUESTED", "IN_ARBITRATION"]
          }
        }
      }),
      prisma.certification.count({
        where: {
          deletedAt: null,
          status: "PENDING"
        }
      }),
      prisma.workspaceSubmission.count({
        where: {
          deletedAt: null,
          status: "PENDING"
        }
      }),
      prisma.project.count({
        where: {
          deletedAt: null,
          status: "AWARDED"
        }
      }),
      prisma.riskEvent.findMany({
        where: {
          deletedAt: null
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5,
        select: {
          id: true,
          type: true,
          level: true,
          status: true,
          title: true,
          createdAt: true
        }
      }),
      prisma.adminReviewCase.findMany({
        where: {
          deletedAt: null
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5,
        select: {
          id: true,
          targetType: true,
          status: true,
          title: true,
          createdAt: true
        }
      }),
      prisma.disputeCase.findMany({
        where: {
          deletedAt: null
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5,
        select: {
          id: true,
          projectId: true,
          status: true,
          reason: true,
          createdAt: true
        }
      }),
      prisma.workspaceSubmission.findMany({
        where: {
          deletedAt: null
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5,
        select: {
          id: true,
          projectId: true,
          title: true,
          status: true,
          createdAt: true
        }
      })
    ]);

    return ok(
      {
        metrics: {
          pendingRiskEvents,
          pendingReviewCases,
          pendingDisputes,
          pendingCertifications,
          pendingWorkspaceSubmissions,
          awardedProjects
        },
        latestRiskEvents,
        latestReviewCases,
        latestDisputes,
        latestWorkspaceSubmissions
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
