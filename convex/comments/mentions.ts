import type { Id } from "@/convex/_generated/dataModel"
import type { QueryCtx } from "@/convex/_generated/server"
import { MENTION_TOKEN, replaceMentions } from "@/convex/comments/mentionTokens"

export interface ResolvedMention {
  id: Id<"users">
  name: string
}

export async function resolveMentions(
  ctx: Pick<QueryCtx, "db">,
  rawUserIds: readonly string[]
): Promise<Map<string, ResolvedMention>> {
  const resolved = new Map<string, ResolvedMention>()
  for (const raw of new Set(rawUserIds)) {
    const id = ctx.db.normalizeId("users", raw)
    if (id === null) continue
    const user = await ctx.db.get("users", id)
    if (user === null) continue
    resolved.set(raw, { id, name: user.name ?? "Unknown user" })
  }
  return resolved
}

export async function resolveBodyMentions(
  ctx: Pick<QueryCtx, "db">,
  body: string
): Promise<Map<string, ResolvedMention>> {
  return await resolveMentions(
    ctx,
    [...body.matchAll(MENTION_TOKEN)].map(([, rawId]) => rawId)
  )
}

export function renderMentionText(
  body: string,
  names: Map<string, ResolvedMention>,
  isReadable?: (userId: Id<"users">) => boolean
): string {
  return replaceMentions(body, (rawId) => {
    const mention = names.get(rawId)
    if (mention === undefined) return undefined
    if (isReadable !== undefined && !isReadable(mention.id)) return "@someone"
    return `@${mention.name}`
  })
}
