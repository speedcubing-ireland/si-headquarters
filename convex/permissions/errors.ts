import { ConvexError } from "convex/values"

export function throwForbidden(message: string): never {
  throw new ConvexError({
    code: "FORBIDDEN",
    message,
  })
}
