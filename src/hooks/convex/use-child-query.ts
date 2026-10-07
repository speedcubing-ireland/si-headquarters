import { useQuery_experimental } from "convex/react"
import type { DefaultFunctionArgs, FunctionReference } from "convex/server"

/** Start a child request alongside its parent, but let the parent establish
 * whether the entity exists before exposing child data or errors.
 */
export function useChildQuery<Args extends DefaultFunctionArgs, Result>(
  query: FunctionReference<"query", "public", Args, Result>,
  args: Args,
  parent: object | null | undefined
): Result | undefined {
  const result = useQuery_experimental({
    query,
    args: parent === null ? "skip" : args,
  })
  if (parent === null || parent === undefined) return undefined
  if (result.status === "error") throw result.error
  return result.status === "success" ? result.data : undefined
}
