import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";
import { fail, ok } from "@/lib/utils/api-response";
import { AppError } from "@/lib/errors/AppError";

const allowedMimeTypes = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/octet-stream",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/x-python",
  "text/x-typescript",
  "text/x-javascript",
  "application/json",
  "application/xml",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime"
]);

const allowedExtensions = new Set([
  ".zip",
  ".rar",
  ".7z",
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".log",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".sql",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".mp4",
  ".mov"
]);

/**
 * @permission authenticated
 * @role developer
 * @resource file
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthUser();
    if (actor.role !== "DEVELOPER") {
      throw new AppError("FORBIDDEN", "仅乙方可上传工作区文件", 403);
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("FILE_REQUIRED", "请上传文件", 422);
    }
    const ext = path.extname(file.name).toLowerCase();
    const mime = file.type?.toLowerCase() ?? "";
    const mimeAllowed = allowedMimeTypes.has(mime);
    const extensionAllowed = allowedExtensions.has(ext);
    if (!mimeAllowed && !extensionAllowed) {
      throw new AppError("FILE_TYPE_INVALID", "不支持的文件类型，请上传常见文档/压缩包/代码文件/图片或视频格式", 422, {
        mimeType: file.type,
        fileName: file.name
      });
    }
    if (file.size > 200 * 1024 * 1024) {
      throw new AppError("FILE_TOO_LARGE", "文件大小不能超过200MB", 422);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileName = `${randomUUID()}${ext}`;
    const relativeDir = "/uploads/workspace";
    const fullDir = path.join(process.cwd(), "public", "uploads", "workspace");
    await mkdir(fullDir, { recursive: true });
    await writeFile(path.join(fullDir, fileName), bytes);

    return ok(
      {
        fileName: file.name,
        url: `${relativeDir}/${fileName}`,
        fileSize: file.size,
        mimeType: file.type
      },
      201
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, error.statusCode, error.details);
    }
    return fail("INTERNAL_ERROR", "系统异常", 500);
  }
}
