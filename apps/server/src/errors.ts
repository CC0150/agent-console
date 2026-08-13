/**
 * 业务错误：由路由抛出，错误中间件统一转换为结构化响应。
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}
