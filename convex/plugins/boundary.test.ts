import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, test } from "vitest"

const backendCoreDirs = [
  "convex/competitions",
  "convex/projects",
  "convex/tasks",
  "convex/notifications",
  "convex/phases",
  "convex/updates",
  "convex/templates",
  "convex/users",
  "convex/impersonation",
  "convex/integrations",
  "convex/projectWorkflows",
  "convex/access",
]

const frontendCoreDirs = ["src/features", "src/components"]

const backendPluginImport =
  /@\/convex\/plugins\/(?!registry(?:\.|")|validators(?:\.|")|oauth(?:\.|")|oauthProvider(?:\.|")|oauthRegistry(?:\.|"))([A-Za-z0-9_-]+)\//g

const frontendPluginImport =
  /@\/plugins\/(?!registry(?:\.|")|integrations\/)([A-Za-z0-9_-]+)\//g

const frontendNamedPluginApi = /api\.plugins\.([A-Za-z0-9_]+)\./g

function sourceFiles(root: string): string[] {
  const files: string[] = []

  function visit(path: string) {
    for (const entry of readdirSync(path)) {
      const child = join(path, entry)
      const stat = statSync(child)
      if (stat.isDirectory()) {
        visit(child)
        continue
      }
      if (/\.(ts|tsx)$/.test(child) && !child.includes("_generated")) {
        files.push(child)
      }
    }
  }

  visit(root)
  return files
}

function restrictedImports(
  roots: readonly string[],
  pattern: RegExp
): string[] {
  return roots.flatMap((root) =>
    sourceFiles(root).flatMap((file) => {
      const source = readFileSync(file, "utf8")
      const matches = [...source.matchAll(pattern)]
      return matches.map(
        (match) => `${relative(process.cwd(), file)} imports ${match[0]}`
      )
    })
  )
}

describe("plugin boundaries", () => {
  test("backend core and plugin infrastructure do not import plugin implementations directly", () => {
    expect(restrictedImports(backendCoreDirs, backendPluginImport)).toEqual([])
  })

  test("frontend features and shared components use plugin registries", () => {
    expect(restrictedImports(frontendCoreDirs, frontendPluginImport)).toEqual(
      []
    )
  })

  test("frontend features and shared components do not call named plugin APIs directly", () => {
    expect(restrictedImports(frontendCoreDirs, frontendNamedPluginApi)).toEqual(
      []
    )
  })
})
