import { unknownErrorMessage } from "@/convex/plugins/core/errorPayload"

/** Format errors from `catch` bindings at the app boundary. */
export function formatCatchError(
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- catch bindings are unknown
  caught: unknown
): string {
  return unknownErrorMessage(caught, { includeConvexError: true })
}
