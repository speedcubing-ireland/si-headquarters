import { env } from "@/convex/_generated/server"

export type ConvexEnv = typeof env
export type ConvexEnvName = keyof ConvexEnv

export type RequiredStringConvexEnvName = {
  [K in ConvexEnvName]: ConvexEnv[K] extends string ? K : never
}[ConvexEnvName]

export type StringConvexEnvName = {
  [K in ConvexEnvName]: ConvexEnv[K] extends string | undefined ? K : never
}[ConvexEnvName]

export type ConvexEnvSource<K extends StringConvexEnvName> = {
  readonly [P in K]: ConvexEnv[P] | undefined
}

export function requireConvexEnv<K extends StringConvexEnvName>(
  name: K,
  message: string,
  source: ConvexEnvSource<K> = env
): string {
  const value = source[name]
  if (typeof value !== "string" || value === "") {
    throw new Error(message)
  }
  return value
}
