import "server-only";
import { NextResponse } from "next/server";
import { log, errorMessage } from "@/lib/log";
import { alert } from "@/lib/alerts";

/**
 * An error that is safe to show the customer. Anything else becomes a generic
 * message — raw errors and stack traces never reach the browser.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly userMessage: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(`${code}: ${userMessage}`);
  }
}

export const Errors = {
  badRequest: (msg = "Something about that request wasn't right. Please try again.") =>
    new ApiError(400, "BAD_REQUEST", msg),
  unauthorized: () =>
    new ApiError(
      401,
      "UNAUTHORIZED",
      "We couldn't confirm this is your surprise. Use your recovery code to continue.",
    ),
  notFound: () => new ApiError(404, "NOT_FOUND", "We couldn't find that surprise."),
  conflict: (code: string, msg: string) => new ApiError(409, code, msg),
  locked: () => new ApiError(409, "LOCKED", "This surprise is already live, so it can no longer be edited."),
  validation: (fields: Record<string, string>) =>
    new ApiError(422, "VALIDATION", "A few things still need your attention.", { fields }),
  manualOrdersOnly: () =>
    new ApiError(403, "MANUAL_ORDERS_ONLY", "Orders are taken by message for now. Message us to get your private link."),
  rateLimited: () =>
    new ApiError(429, "RATE_LIMITED", "You're going a little fast. Please wait a moment and try again."),
  unavailable: (msg = "Something went wrong on our side. Your work has not been lost. Please try again.") =>
    new ApiError(503, "UNAVAILABLE", msg),
};

export function jsonError(err: unknown, context: string): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.userMessage, ...err.details } },
      { status: err.status },
    );
  }
  log.error("unhandled_error", { context, error: errorMessage(err) });
  alert("server_error", { "Where": context });
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message: "Something went wrong on our side. Your work has not been lost. Please try again.",
      },
    },
    { status: 500 },
  );
}

/** Wraps a route handler so every failure becomes a friendly JSON error. */
export function route<Args extends unknown[]>(
  context: string,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      return jsonError(err, context);
    }
  };
}
