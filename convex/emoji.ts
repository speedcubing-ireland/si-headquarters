const EMOJI_REGEX =
  /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D]+$/u

export function normalizeEmoji(value: string) {
  const emoji = value.trim()

  if (!emoji) throw new Error("Reaction emoji is required")
  if (Array.from(emoji).length > 16)
    throw new Error("Reaction emoji is too long")
  if (!EMOJI_REGEX.test(emoji))
    throw new Error("Reaction emoji must be an emoji")

  return emoji
}
