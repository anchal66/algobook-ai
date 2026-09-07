/** Structured API errors (Master Plan §6: `{ error: { code, message } }`). */
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "PAYMENT_REQUIRED"
  | "QUOTA_EXCEEDED"
  | "LANGUAGE_NOT_READY"
  | "GONE"
  | "UPSTREAM"
  | "INTERNAL";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message, ...(this.details !== undefined ? { details: this.details } : {}) } };
  }

  static unauthenticated(msg = "Sign in required") { return new ApiError(401, "UNAUTHENTICATED", msg); }
  static forbidden(msg = "Not allowed") { return new ApiError(403, "FORBIDDEN", msg); }
  static notFound(msg = "Not found") { return new ApiError(404, "NOT_FOUND", msg); }
  static validation(msg = "Invalid request", details?: unknown) { return new ApiError(400, "VALIDATION", msg, details); }
  static conflict(msg: string, details?: unknown) { return new ApiError(409, "CONFLICT", msg, details); }
  static paymentRequired(msg = "This feature requires a Pro plan") { return new ApiError(402, "PAYMENT_REQUIRED", msg); }
  static quotaExceeded(resetAt: string, msg = "Daily quota exceeded") { return new ApiError(429, "QUOTA_EXCEEDED", msg, { resetAt }); }
  static gone(msg = "This endpoint was removed") { return new ApiError(410, "GONE", msg); }
  static upstream(msg = "Upstream service failed", details?: unknown) { return new ApiError(502, "UPSTREAM", msg, details); }
  static internal(msg = "Internal error") { return new ApiError(500, "INTERNAL", msg); }
}
