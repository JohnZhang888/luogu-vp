export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export class AuthRequiredError extends AppError {
  constructor(message = '需要先登录洛谷。') {
    super('AUTH_REQUIRED', message, 401);
    this.name = 'AuthRequiredError';
  }
}

export class LuoguApiError extends AppError {
  readonly errorType: string | null;

  constructor(message: string, errorType: string | null = null, status = 502) {
    super('LUOGU_API_ERROR', message, status);
    this.name = 'LuoguApiError';
    this.errorType = errorType;
  }
}

export function isAuthError(errorType: string | null | undefined): boolean {
  if (!errorType) return false;
  return /UserNotLoggedIn|UserUnlogin|needLogin/i.test(errorType);
}

export function asJobError(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return { code: 'TIMEOUT', message: '请求超时，请稍后重试。' };
  }
  return { code: 'INTERNAL', message: '提交失败，请稍后重试。' };
}
