// PKCE (RFC 7636) helpers shared by the browser connect flow in
// `convex/integrations/serviceAccountConnect.ts` and the `bun run auth` CLI in
// `scripts/lib/oauth-cli.ts`.
//
// Deliberately import-free so both callers can use it: the CLI runs under Bun
// and cannot pull in `@/convex/_generated/server`, and the Convex V8 runtime has
// no `Buffer`, so the base64url encoding goes through `btoa` instead (the same
// call `oauthProvider.ts` already makes for basic auth headers).

export interface PkcePair {
  codeVerifier: string
  codeChallenge: string
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return globalThis
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

export async function generatePkcePair(): Promise<PkcePair> {
  const codeVerifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  )
  return { codeVerifier, codeChallenge: toBase64Url(new Uint8Array(digest)) }
}
