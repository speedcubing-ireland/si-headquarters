import type { Doc } from "@/convex/_generated/dataModel"

const DICEBEAR_INITIALS_BASE =
  "https://api.dicebear.com/9.x/initials/svg?seed="

export function dicebearInitialsUrl(seed: string): string {
  return `${DICEBEAR_INITIALS_BASE}${encodeURIComponent(seed)}`
}

export function resolveDiscordAvatarUrl(
  discordUserId: string,
  avatarHash: string | undefined
): string {
  if (avatarHash !== undefined && avatarHash.length > 0) {
    const extension = avatarHash.startsWith("a_") ? "gif" : "png"
    return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.${extension}?size=128`
  }
  const index = Number((BigInt(discordUserId) >> 22n) % 6n)
  return `https://cdn.discordapp.com/embed/avatars/${String(index)}.png`
}

export function resolveUserAvatarUrl(
  user: Pick<
    Doc<"users">,
    "name" | "image" | "discordUserId" | "discordAvatarHash"
  >
): string | undefined {
  if (user.discordUserId !== undefined) {
    return resolveDiscordAvatarUrl(user.discordUserId, user.discordAvatarHash)
  }
  if (user.image !== undefined && user.image.length > 0) {
    return user.image
  }
  const seed = user.name?.trim()
  if (seed !== undefined && seed.length > 0) {
    return dicebearInitialsUrl(seed)
  }
  return undefined
}
