export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * 生产构建偶发多份 bundle 时 `instanceof AppError` 不可靠，用结构校验兜底。
 */
export function isAppErrorLike(error: unknown): error is AppError {
  if (error instanceof AppError) {
    return true;
  }
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const e = error as Record<string, unknown>;
  return (
    typeof e.code === "string" &&
    typeof e.message === "string" &&
    typeof e.statusCode === "number" &&
    e instanceof Error
  );
}
