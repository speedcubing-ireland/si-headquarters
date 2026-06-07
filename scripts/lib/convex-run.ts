import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

export type ConvexArgs = Record<string, string | undefined>

export async function convexRun<T>(
  functionPath: string,
  args: ConvexArgs
): Promise<T> {
  const filteredArgs = Object.fromEntries(
    Object.entries(args).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
  const prod =
    process.env.CONVEX_PROD === "1" || process.env.CONVEX_PROD === "true"
  const proc = Bun.spawn(
    [
      "bunx",
      "convex",
      "run",
      ...(prod ? ["--prod"] : []),
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
  // CLI boundary: Convex prints JSON; callers specify the expected shape.
  // oxlint-disable-next-line typescript/consistent-type-assertions -- convex run stdout
  return JSON.parse(stdout.trim()) as T
}
