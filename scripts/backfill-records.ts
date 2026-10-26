#!/usr/bin/env bun
import { readFileSync } from "node:fs"
import { competitionCountryIso2 } from "../config/lib/organisation.ts"
import { toHistoryRecords } from "../convex/plugins/socialMedia/records/history.ts"
import { convexRun } from "./lib/convex-run.ts"

/** Small enough for one command-line argument and one mutation. */
const CHUNK_SIZE = 100

interface ImportResult {
  inserted: number
  skipped: number
}

function printUsage(): void {
  console.log(
    [
      "Usage: bun run backfill-records <records.json> [--dry-run]",
      "",
      "Imports the WCA's records history into the Records tab. Save the file",
      "from a browser, as the WCA turns bots away:",
      `  https://www.worldcubeassociation.org/api/v0/results/records?region=${competitionCountryIso2()}&show=history`,
      "",
      "Targets the dev deployment; set CONVEX_PROD=1 for production.",
      "Records already stored are skipped, so it is safe to re-run.",
    ].join("\n")
  )
}

async function main(argv: readonly string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run")
  const files = argv.filter((arg) => !arg.startsWith("--"))
  const file = files[0]
  if (file === undefined || files.length > 1 || argv.includes("--help")) {
    printUsage()
    process.exit(file === undefined || files.length > 1 ? 1 : 0)
  }

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
      { records: records.slice(start, start + CHUNK_SIZE), dryRun }
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
