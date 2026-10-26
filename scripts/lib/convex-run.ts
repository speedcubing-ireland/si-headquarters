import type { Value } from "convex/values"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

export type ConvexArgs = Record<string, Value | undefined>

/**
 * Runs a Convex function on the dev deployment, on production with
 * `CONVEX_PROD=1`, or on `deployment`: any reference `convex run --deployment`
 * accepts, such as `team-slug:project-slug:prod` for another team's project.
 */
export async function convexRun<T>(
  functionPath: string,
  args: ConvexArgs,
  deployment?: string
): Promise<T> {
  const filteredArgs = Object.fromEntries(
    Object.entries(args).filter((entry) => entry[1] !== undefined)
  )
  const prod =
    process.env.CONVEX_PROD === "1" || process.env.CONVEX_PROD === "true"
  const proc = Bun.spawn(
    [
      "bunx",
      "convex",
      "run",
      ...(deployment !== undefined
        ? ["--deployment", deployment]
        : prod
          ? ["--prod"]
          : []),
      functionPath,
      JSON.stringify(filteredArgs),
    ],
    { cwd: repoRoot, stdout: "pipe", stderr: "pipe" }
  )
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  if ((await proc.exited) !== 0) {
    const stderrMessage = stderr.trim()
    const stdoutMessage = stdout.trim()
    throw new Error(stderrMessage !== "" ? stderrMessage : stdoutMessage)
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- convex run stdout
  return JSON.parse(stdout.trim()) as T
}
