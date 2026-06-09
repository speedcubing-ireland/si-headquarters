import { ConvexError } from "convex/values"

export function throwForbidden(message?: string): never {
  throw new ConvexError({
    code: "FORBIDDEN",
    message: message ?? "You do not have permission to perform this action.",
  })
}

export function throwNotFound(message: string): never {
  throw new ConvexError({
    code: "NOT_FOUND",
    message,
  })
}
