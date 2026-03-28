import { AppError } from "@/lib/errors/AppError";

const allowedMimeToExt: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

function extFromFileName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) {
    return ".jpg";
  }
  if (lower.endsWith(".png")) {
    return ".png";
  }
  if (lower.endsWith(".webp")) {
    return ".webp";
  }
  return null;
}

function extFromMagic(head: Uint8Array): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return ".jpg";
  }
  if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    return ".png";
  }
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return ".webp";
  }
  return null;
}

/**
 * 解析头像扩展名：兼容部分浏览器/系统上报空 MIME（如部分移动端相册）。
 * 使用 Blob 而非 File，避免 Node/Undici 下 `instanceof File` 与浏览器不一致导致误判。
 */
export async function resolveAvatarExtension(blob: Blob, fileName = ""): Promise<string> {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const magicExt = extFromMagic(head);

  const mimeType = blob.type ?? "";
  const mimeExt = allowedMimeToExt[mimeType];
  if (mimeExt) {
    if (magicExt && magicExt !== mimeExt) {
      throw new AppError("FILE_TYPE_INVALID", "文件内容与声明类型不符，请使用 jpg/png/webp", 422);
    }
    return mimeExt;
  }

  const nameExt = extFromFileName(fileName);
  const ext = magicExt ?? nameExt;
  if (!ext) {
    throw new AppError("FILE_TYPE_INVALID", "仅支持 jpg/png/webp 格式（若从相册选择，请重命名或换一张）", 422);
  }
  if (nameExt && magicExt && nameExt !== magicExt) {
    throw new AppError("FILE_TYPE_INVALID", "文件名与图片实际格式不一致", 422);
  }
  return ext;
}

export function getBlobReadWriteToken(): string | undefined {
  const raw = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (raw) {
    return raw;
  }
  return process.env.VERCEL_BLOB_READ_WRITE_TOKEN?.trim();
}

const extToContentType: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

export function avatarContentTypeForExt(ext: string): string {
  return extToContentType[ext] ?? "application/octet-stream";
}

/** Vercel Blob：私有 Store 不允许 `access: "public"` 上传时的 SDK 报错文案片段 */
export function isPrivateStorePublicUploadError(message: string): boolean {
  return /private store|public access on a private/i.test(message);
}

/** 返回经本站代理的头像 URL（用于私有 Blob，供 img src 使用） */
export function avatarMediaProxyUrl(blobPathname: string): string {
  const parts = blobPathname.split("/").filter(Boolean);
  return `/api/v1/files/avatar-media/${parts.map(encodeURIComponent).join("/")}`;
}
