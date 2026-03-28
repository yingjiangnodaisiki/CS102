import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";

const allowedMimeToExt: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

/**
 * @permission authenticated
 * @role client|developer
 * @resource file
 */
export async function POST(request: NextRequest) {
  try {
    await getAuthUser();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("FILE_REQUIRED", "请上传头像文件", 422);
    }
    const ext = allowedMimeToExt[file.type];
    if (!ext) {
      throw new AppError("FILE_TYPE_INVALID", "仅支持 jpg/png/webp 格式", 422);
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new AppError("FILE_TOO_LARGE", "头像文件不能超过2MB", 422);
    }

    const fileName = `${randomUUID()}${ext}`;

    // Vercel：使用 Blob 存储（需在环境变量中配置 BLOB_READ_WRITE_TOKEN）
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`avatars/${fileName}`, file, {
        access: "public",
        addRandomSuffix: false
      });
      return ok({ url: blob.url }, 201);
    }

    // Vercel 且无 Blob：无法写本地磁盘
    if (process.env.VERCEL === "1") {
      throw new AppError(
        "FILE_STORAGE_UNAVAILABLE",
        "当前环境未配置对象存储。请在 Vercel 项目设置中新增 BLOB_READ_WRITE_TOKEN（Storage → Create → 复制 Token），或改用「头像地址（URL）」",
        503
      );
    }

    // 本地 / 自建 Docker：写入 public/uploads
    const bytes = Buffer.from(await file.arrayBuffer());
    const relativeDir = "/uploads/avatars";
    const fullDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(fullDir, { recursive: true });
    await writeFile(path.join(fullDir, fileName), bytes);

    return ok({ url: `${relativeDir}/${fileName}` }, 201);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
