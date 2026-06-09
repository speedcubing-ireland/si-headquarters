import { webcrypto } from "node:crypto"
import {
  REQUIRED_ENV_SETUP,
  type EnvSetupGroup,
  type EnvSetupKind,
  type EnvSetupSpec,
} from "../../convex/envConfig.ts"

export type EnvGroup = EnvSetupGroup
export type EnvInputKind = EnvSetupKind

export interface EnvSpec extends EnvSetupSpec {
  generatedValue?: string
}

export interface GeneratedEnvValues {
  CLI_AUTH_TOKEN: string
  DISCORD_ACTION_SECRET: string
  JWT_PRIVATE_KEY: string
  JWKS: string
  SPONSOR_BETTER_AUTH_SECRET: string
}

export interface EnvChangePlanEntry {
  key: string
  action: "set" | "skip-existing"
}

interface RsaPublicJwk {
  kty?: string
  n?: string
  e?: string
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  webcrypto.getRandomValues(bytes)
  return bytes
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64")
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function toPem(label: string, der: ArrayBuffer): string {
  const base64 = Buffer.from(der).toString("base64")
  const lines = base64.match(/.{1,64}/g) ?? []
  return [`-----BEGIN ${label}-----`, ...lines, `-----END ${label}-----`].join(
    "\n"
  )
}

export async function generateConvexAuthKeys(): Promise<
  Pick<GeneratedEnvValues, "JWT_PRIVATE_KEY" | "JWKS">
> {
  const keys = await webcrypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  )
  const [privateKeyDer, rawPublicJwk] = await Promise.all([
    webcrypto.subtle.exportKey("pkcs8", keys.privateKey),
    webcrypto.subtle.exportKey("jwk", keys.publicKey),
  ])
  const publicJwk: RsaPublicJwk = rawPublicJwk
  if (
    publicJwk.kty !== "RSA" ||
    publicJwk.n === undefined ||
    publicJwk.e === undefined
  ) {
    throw new Error("Generated Convex Auth public key was not an RSA JWK.")
  }
  const privateKey = toPem("PRIVATE KEY", privateKeyDer)
    .trimEnd()
    .replace(/\n/g, " ")
  return {
    JWT_PRIVATE_KEY: privateKey,
    JWKS: JSON.stringify({
      keys: [
        { use: "sig", kty: publicJwk.kty, n: publicJwk.n, e: publicJwk.e },
      ],
    }),
  }
}

export async function generateEnvValues(): Promise<GeneratedEnvValues> {
  const authKeys = await generateConvexAuthKeys()
  return {
    CLI_AUTH_TOKEN: toHex(randomBytes(32)),
    DISCORD_ACTION_SECRET: toBase64(randomBytes(32)),
    SPONSOR_BETTER_AUTH_SECRET: toBase64(randomBytes(32)),
    ...authKeys,
  }
}

function generatedValueFor(
  key: string,
  generated: Partial<GeneratedEnvValues> | undefined
): string | undefined {
  if (key === "CLI_AUTH_TOKEN") return generated?.CLI_AUTH_TOKEN
  if (key === "DISCORD_ACTION_SECRET") return generated?.DISCORD_ACTION_SECRET
  if (key === "JWT_PRIVATE_KEY") return generated?.JWT_PRIVATE_KEY
  if (key === "JWKS") return generated?.JWKS
  if (key === "SPONSOR_BETTER_AUTH_SECRET")
    return generated?.SPONSOR_BETTER_AUTH_SECRET
  return undefined
}

export function buildWizardEnvSpecs(
  generated?: Partial<GeneratedEnvValues>,
  setup: readonly EnvSetupSpec[] = REQUIRED_ENV_SETUP
): EnvSpec[] {
  return setup.map((spec) => ({
    ...spec,
    generatedValue:
      spec.kind === "generated"
        ? generatedValueFor(spec.key, generated)
        : undefined,
  }))
}

export function parseConvexEnvList(output: string): Set<string> {
  const keys = output
    .split(/\r?\n/)
    .map((line) => /^([A-Z0-9_]+)=/.exec(line.trim())?.[1])
    .filter((key): key is string => key !== undefined)
  return new Set(keys)
}

export function planEnvChanges(
  specs: readonly EnvSpec[],
  existingKeys: ReadonlySet<string>,
  options?: {
    force?: boolean
    replaceExistingKeys?: ReadonlySet<string>
  }
): EnvChangePlanEntry[] {
  const force = options?.force === true
  const replaceExistingKeys = options?.replaceExistingKeys ?? new Set<string>()
  return specs.map((spec) => {
    const exists = existingKeys.has(spec.key)
    const replaceExisting = force || replaceExistingKeys.has(spec.key)
    return {
      key: spec.key,
      action: exists && !replaceExisting ? "skip-existing" : "set",
    }
  })
}

export function validateEnvValue(spec: EnvSpec, value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === "") {
    return `${spec.key} is required.`
  }
  if (
    /^<.*>$/.test(trimmed) ||
    /^(todo|tbd|placeholder|changeme)$/i.test(trimmed)
  ) {
    return `${spec.key} must be a real value, not a placeholder.`
  }
  if (spec.choices !== undefined && !spec.choices.includes(trimmed)) {
    return `${spec.key} must be one of: ${spec.choices.join(", ")}.`
  }
  return null
}

export function updateDotenvContent(
  content: string,
  key: string,
  value: string
): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${escapedKey}=.*$`, "m")
  if (pattern.test(content)) {
    return content.replace(pattern, line)
  }

  if (content === "") {
    return `${line}\n`
  }
  return `${content}${content.endsWith("\n") ? "" : "\n"}${line}\n`
}

export function renderDryRunPlan(specs: readonly EnvSpec[]): string {
  const lines = [
    "Convex env wizard dry run",
    "",
    "The wizard would configure these keys without printing secret values:",
  ]
  let currentGroup: EnvGroup | null = null
  for (const spec of specs) {
    if (spec.group !== currentGroup) {
      currentGroup = spec.group
      lines.push("", `${currentGroup}:`)
    }
    const source =
      spec.kind === "generated"
        ? "generated"
        : spec.defaultValue !== undefined
          ? "prompt, default available"
          : "prompt"
    lines.push(`  - ${spec.key} (${source})`)
  }
  return lines.join("\n")
}
