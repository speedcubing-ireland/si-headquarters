#!/usr/bin/env bun
import { readFileSync } from "node:fs"
import { competitionCountryIso2 } from "../config/lib/organisation.ts"
import { toHistoryRecords } from "../convex/plugins/socialMedia/records/history.ts"
import { convexRun } from "./lib/convex-run.ts"

/** Small enough for one command-line argument and one mutation. */
const CHUNK_SIZE = 100

interface CliOptions {
  file: string
  dryRun: boolean
  deployment: string | undefined
}

interface ImportResult {
  inserted: number
  skipped: number
}

function printUsage(): void {
  console.log(
    [
      "Usage: bun run backfill-records <records.json> [--deployment <ref>] [--dry-run]",
      "",
      "Imports the WCA's records history into the Records tab. Save the file",
      "from a browser, as the WCA turns bots away:",
      `  https://www.worldcubeassociation.org/api/v0/results/records?region=${competitionCountryIso2()}&show=history`,
      "",
      "Targets the dev deployment unless --deployment names another, as",
      "`convex run --deployment` accepts it: `prod`, or",
      "`team-slug:project-slug:prod` for a project in another team.",
      "Records already stored are skipped, so it is safe to re-run.",
    ].join("\n")
  )
}

function parseArgs(argv: readonly string[]): CliOptions {
  const files: string[] = []
  let dryRun = false
  let deployment: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === undefined) continue
    if (arg === "--deployment") {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--deployment requires a value.")
      }
      deployment = value
      index += 1
    } else if (arg === "--dry-run") {
      dryRun = true
    } else if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`)
    } else {
      files.push(arg)
    }
  }
  const file = files[0]
  if (file === undefined || files.length > 1) {
    printUsage()
    process.exit(1)
  }
  return { file, dryRun, deployment }
}

async function main(argv: readonly string[]): Promise<void> {
  const { file, dryRun, deployment } = parseArgs(argv)
  console.log(`Target deployment: ${deployment ?? "dev"}`)

  const records = toHistoryRecords(
    readFileSync(file, "utf8"),
    competitionCountryIso2()
  )
  console.log(
    `${dryRun ? "Checking" : "Importing"} ${String(records.length)} records…`
  )

  const total: ImportResult = { inserted: 0, skipped: 0 }
  for (let start = 0; start < records.length; start += CHUNK_SIZE) {
    const result = await convexRun<ImportResult>(
      "plugins/socialMedia/records/backfill:importHistory",
      { records: records.slice(start, start + CHUNK_SIZE), dryRun },
      deployment
    )
    total.inserted += result.inserted
    total.skipped += result.skipped
    console.log(
      `  ${String(Math.min(start + CHUNK_SIZE, records.length))}/${String(records.length)}`
    )
  }

  console.log(
    `${dryRun ? "Would insert" : "Inserted"} ${String(total.inserted)}, skipped ${String(total.skipped)} already stored.`
  )
}

await main(process.argv.slice(2))
