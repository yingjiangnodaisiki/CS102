import { randomUUID } from "crypto";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError, isAppErrorLike } from "@/lib/errors/AppError";
import {
  avatarContentTypeForExt,
  getBlobReadWriteToken,
  resolveAvatarExtension
} from "@/lib/utils/avatar-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function blobFailureResponse(e: unknown): NextResponse {
  const base =
    "头像存储失败。请确认 Vercel 已创建 Blob Store、环境变量 BLOB_READ_WRITE_TOKEN（或 VERCEL_BLOB_READ_WRITE_TOKEN）已关联本项目并已 Redeploy。";
  const detail = e instanceof Error ? e.message : String(e);
  console.error("[avatar] vercel blob put failed:", detail, e);
  return fail("BLOB_UPLOAD_FAILED", `${base}（详情：${detail}）`, 502);
}

/**
 * @permission authenticated
 * @role client|developer
 * @resource file
 */
export async function POST(request: NextRequest) {
  try {
    await getAuthUser();

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[avatar] formData:", msg);
      throw new AppError("BAD_REQUEST", "无法解析上传内容，请重试或使用较小的图片", 400);
    }

    const raw = formData.get("file");
    if (!(raw instanceof Blob)) {
      throw new AppError("FILE_REQUIRED", "请上传头像文件", 422);
    }
    const originalName = raw instanceof File ? raw.name : "";

    const ext = await resolveAvatarExtension(raw, originalName);
    if (raw.size > 2 * 1024 * 1024) {
      throw new AppError("FILE_TOO_LARGE", "头像文件不能超过2MB", 422);
    }

    const fileName = `${randomUUID()}${ext}`;
    const bytes = Buffer.from(await raw.arrayBuffer());

    const blobToken = getBlobReadWriteToken();
    if (blobToken) {
      try {
        const { put } = await import("@vercel/blob");
        const blob = await put(`avatars/${fileName}`, bytes, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          token: blobToken,
          contentType: avatarContentTypeForExt(ext)
        });
        return ok({ url: blob.url }, 201);
      } catch (e: unknown) {
        return blobFailureResponse(e);
      }
    }

    if (process.env.VERCEL === "1") {
      throw new AppError(
        "FILE_STORAGE_UNAVAILABLE",
        "当前环境未配置对象存储。请在 Vercel 项目设置中新增 BLOB_READ_WRITE_TOKEN（Storage → Create → 复制 Token），或改用「头像地址（URL）」",
        503
      );
    }

    const { mkdir, writeFile } = await import("fs/promises");
    const relativeDir = "/uploads/avatars";
    const fullDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(fullDir, { recursive: true });
    await writeFile(path.join(fullDir, fileName), bytes);

    return ok({ url: `${relativeDir}/${fileName}` }, 201);
  } catch (error: unknown) {
    if (isAppErrorLike(error)) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[avatar] unhandled:", message, error);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: process.env.NODE_ENV === "development" ? message : "系统异常",
        data: process.env.NODE_ENV === "development" ? { stack: (error as Error)?.stack } : undefined
      },
      { status: 500 }
    );
  }
}
