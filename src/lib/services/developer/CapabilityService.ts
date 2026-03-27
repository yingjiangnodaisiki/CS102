import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors/AppError";
import { AuditLogService } from "@/lib/services/audit/AuditLogService";

interface AuthActor {
  userId: string;
  role: "CLIENT" | "DEVELOPER" | "ADMIN";
}

interface VerifyCapabilityCommand {
  answers: Array<{ questionId: string; optionId: string }>;
  requestIp?: string | null;
  requestDevice?: string | null;
}

const PASS_SCORE = 4;

const CAPABILITY_EXAM = [
  {
    id: "q1",
    question: "以下哪项最能降低大模型幻觉风险？",
    options: [
      { id: "a", label: "仅提高 temperature" },
      { id: "b", label: "引入检索增强(RAG)并约束引用来源" },
      { id: "c", label: "删除系统提示词" },
      { id: "d", label: "只返回更长文本" }
    ],
    correctOptionId: "b"
  },
  {
    id: "q2",
    question: "资金相关服务中，金额计算推荐使用哪种方式？",
    options: [
      { id: "a", label: "JavaScript 原生浮点运算" },
      { id: "b", label: "字符串拼接" },
      { id: "c", label: "decimal.js 精确计算" },
      { id: "d", label: "只在前端计算" }
    ],
    correctOptionId: "c"
  },
  {
    id: "q3",
    question: "支付回调的关键保障是？",
    options: [
      { id: "a", label: "允许重复入账" },
      { id: "b", label: "幂等校验 + 签名校验" },
      { id: "c", label: "忽略状态机" },
      { id: "d", label: "只记录成功，不记录失败" }
    ],
    correctOptionId: "b"
  },
  {
    id: "q4",
    question: "当接口需要分页列表时，推荐响应结构是？",
    options: [
      { id: "a", label: "{ code, data, meta }" },
      { id: "b", label: "{ ok: true, list }" },
      { id: "c", label: "{ status, rows }" },
      { id: "d", label: "{ dataOnly }" }
    ],
    correctOptionId: "a"
  },
  {
    id: "q5",
    question: "为了避免 N+1 查询，应该？",
    options: [
      { id: "a", label: "在循环里逐条查询" },
      { id: "b", label: "把复杂查询封装在 Repository 并 include 关联" },
      { id: "c", label: "把 SQL 写到前端" },
      { id: "d", label: "关闭索引" }
    ],
    correctOptionId: "b"
  }
] as const;

export class CapabilityService {
  static async getMine(actor: AuthActor) {
    if (actor.role !== "DEVELOPER") {
      throw new AppError("FORBIDDEN", "仅开发者可查看能力验证", 403);
    }

    const profile = await prisma.developerProfile.findFirst({
      where: { userId: actor.userId, deletedAt: null },
      include: {
        skills: {
          where: { deletedAt: null },
          include: { skill: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!profile) {
      throw new AppError("PROFILE_NOT_FOUND", "开发者资料不存在", 404);
    }

    return {
      capabilityPassed: profile.capabilityPassed,
      isRiskFrozen: profile.isRiskFrozen,
      verifiedSkills: profile.skills.filter((item) => item.isVerified).map((item) => item.skill.code),
      passScore: PASS_SCORE,
      questions: CAPABILITY_EXAM.map((item) => ({
        id: item.id,
        question: item.question,
        options: item.options
      }))
    };
  }

  static async verifyMine(actor: AuthActor, command: VerifyCapabilityCommand) {
    if (actor.role !== "DEVELOPER") {
      throw new AppError("FORBIDDEN", "仅开发者可进行能力验证", 403);
    }

    const profile = await prisma.developerProfile.findFirst({
      where: { userId: actor.userId, deletedAt: null }
    });
    if (!profile) {
      throw new AppError("PROFILE_NOT_FOUND", "开发者资料不存在", 404);
    }
    if (profile.isRiskFrozen) {
      throw new AppError("DEVELOPER_RISK_FROZEN", "账号已被冻结，暂不可进行能力验证", 403);
    }
    if (profile.capabilityPassed) {
      return {
        capabilityPassed: true,
        score: CAPABILITY_EXAM.length,
        passedAt: profile.updatedAt.toISOString(),
        idempotent: true
      };
    }

    const answersMap = new Map(command.answers.map((item) => [item.questionId, item.optionId]));
    const answeredQuestions = CAPABILITY_EXAM.filter((item) => answersMap.has(item.id));
    if (answeredQuestions.length < CAPABILITY_EXAM.length) {
      throw new AppError("CAPABILITY_EXAM_INCOMPLETE", "能力验证题目未全部完成", 422);
    }
    const score = CAPABILITY_EXAM.reduce((sum, item) => {
      return sum + (answersMap.get(item.id) === item.correctOptionId ? 1 : 0);
    }, 0);
    const passed = score >= PASS_SCORE;

    if (!passed) {
      await AuditLogService.record({
        userId: actor.userId,
        action: "CAPABILITY_VERIFY",
        resource: "DEVELOPER_PROFILE",
        resourceId: profile.id,
        status: "FAILED",
        requestIp: command.requestIp,
        requestDevice: command.requestDevice,
        details: {
          score,
          passScore: PASS_SCORE
        }
      });
      throw new AppError("CAPABILITY_EXAM_FAILED", "能力验证未通过，请完善后重试", 422, {
        score,
        passScore: PASS_SCORE
      });
    }

    await prisma.developerProfile.update({
      where: { id: profile.id },
      data: {
        capabilityPassed: true
      }
    });

    await AuditLogService.record({
      userId: actor.userId,
      action: "CAPABILITY_VERIFY",
      resource: "DEVELOPER_PROFILE",
      resourceId: profile.id,
      status: "SUCCESS",
      requestIp: command.requestIp,
      requestDevice: command.requestDevice,
      details: {
        score,
        passScore: PASS_SCORE
      }
    });

    return {
      capabilityPassed: true,
      score,
      passScore: PASS_SCORE,
      passedAt: new Date().toISOString(),
      idempotent: false
    };
  }
}
