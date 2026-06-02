/** Format errors from `catch` bindings at the app boundary. */
export function formatCatchError(
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- catch bindings are unknown
  caught: unknown
): string {
  return caught instanceof Error ? caught.message : String(caught)
}
