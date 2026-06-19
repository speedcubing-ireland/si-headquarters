export const MENTION_TOKEN = /@([a-zA-Z0-9_\-:]+)/g

export function replaceMentions(
  body: string,
  format: (rawId: string) => string | undefined
): string {
  return body.replace(MENTION_TOKEN, (token, rawId: string) => {
    return format(rawId) ?? token
  })
}
