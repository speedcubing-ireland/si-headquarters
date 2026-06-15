#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { createInterface } from "node:readline/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  buildWizardEnvSpecs,
  generateEnvValues,
  parseConvexEnvList,
  planEnvChanges,
  renderDryRunPlan,
  updateDotenvContent,
  validateEnvValue,
  type EnvSpec,
} from "./lib/set-convex-env.ts"

interface CliOptions {
  deployment: string
  dryRun: boolean
  force: boolean
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function printUsage(): void {
  console.log(
    [
      "Usage: bun run set-convex-env [--deployment <ref>] [--dry-run] [--force]",
      "",
      "Defaults to --deployment dev and keeps existing Convex env vars.",
    ].join("\n")
  )
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    deployment: "dev",
    dryRun: false,
    force: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === undefined) continue
    if (arg === "--deployment") {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--deployment requires a value.")
      }
      options.deployment = value
      index += 1
    } else if (arg === "--dry-run") {
      options.dryRun = true
    } else if (arg === "--force") {
      options.force = true
    } else if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }
  return options
}

async function readProcOutput(
  proc: Bun.Subprocess<"ignore" | "pipe", "pipe", "pipe">
) {
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

async function listExistingEnvKeys(deployment: string): Promise<Set<string>> {
  const proc = Bun.spawn(
    ["bunx", "convex", "env", "list", "--deployment", deployment],
    {
      cwd: repoRoot,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    }
  )
  const { stdout, stderr, exitCode } = await readProcOutput(proc)
  if (exitCode !== 0) {
    throw new Error(stderr.trim() === "" ? stdout.trim() : stderr.trim())
  }
  return parseConvexEnvList(stdout)
}

async function setConvexEnv(
  deployment: string,
  key: string,
  value: string
): Promise<void> {
  const proc = Bun.spawn(
    ["bunx", "convex", "env", "set", "--deployment", deployment, key],
    {
      cwd: repoRoot,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    }
  )
  await proc.stdin.write(value)
  await proc.stdin.end()
  const { stdout, stderr, exitCode } = await readProcOutput(proc)
  if (exitCode !== 0) {
    throw new Error(stderr.trim() === "" ? stdout.trim() : stderr.trim())
  }
}

function createPrompt() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

async function confirm(
  rl: ReturnType<typeof createPrompt>,
  question: string
): Promise<boolean> {
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase()
  return answer === "y" || answer === "yes"
}

async function promptForValue(
  rl: ReturnType<typeof createPrompt>,
  spec: EnvSpec
): Promise<string | null> {
  if (spec.kind === "generated") {
    if (spec.generatedValue === undefined) {
      throw new Error(`${spec.key} was not generated.`)
    }
    return spec.generatedValue
  }

  const defaultSuffix =
    spec.defaultValue === undefined ? "" : ` [${spec.defaultValue}]`
  const choiceSuffix =
    spec.choices === undefined ? "" : ` (${spec.choices.join("/")})`

  for (;;) {
    const raw = await rl.question(
      `${spec.key}${choiceSuffix}${defaultSuffix}: `
    )
    const value =
      raw.trim() === "" && spec.defaultValue !== undefined
        ? spec.defaultValue
        : raw.trim()
    if (value === "" && spec.optional === true) return null
    const validationError = validateEnvValue(spec, value)
    if (validationError === null) return value
    console.error(validationError)
  }
}

function updateLocalCliToken(value: string): void {
  const dotenvPath = resolve(repoRoot, ".env.local")
  const current = existsSync(dotenvPath) ? readFileSync(dotenvPath, "utf8") : ""
  writeFileSync(
    dotenvPath,
    updateDotenvContent(current, "CLI_AUTH_TOKEN", value)
  )
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.dryRun) {
    console.log(renderDryRunPlan(buildWizardEnvSpecs()))
    console.log("")
    console.log(`Target deployment: ${options.deployment}`)
    return
  }

  const generated = await generateEnvValues()
  const specs = buildWizardEnvSpecs(generated)

  console.log(`Configuring Convex env for deployment "${options.deployment}".`)
  console.log("Existing Convex values will be kept unless you replace them.\n")

  const existingKeys = await listExistingEnvKeys(options.deployment)
  if (existingKeys.size > 0) {
    console.log(
      `Existing keys: ${[...existingKeys].sort((a, b) => a.localeCompare(b)).join(", ")}\n`
    )
  }

  const rl = createPrompt()
  const values = new Map<string, string>()
  const replaceExistingKeys = new Set<string>()
  try {
    for (const spec of specs) {
      if (existingKeys.has(spec.key) && !options.force) {
        const shouldReplace = await confirm(
          rl,
          `${spec.key} already exists. Replace it?`
        )
        if (!shouldReplace) continue
        replaceExistingKeys.add(spec.key)
      }
      const value = await promptForValue(rl, spec)
      if (value !== null) {
        values.set(spec.key, value)
      }
    }
  } finally {
    rl.close()
  }

  const plan = planEnvChanges(specs, existingKeys, {
    force: options.force,
    replaceExistingKeys,
    providedKeys: new Set(values.keys()),
  })

  for (const entry of plan) {
    if (entry.action === "skip-existing") {
      console.log(`Skipping ${entry.key} (already set).`)
      continue
    }
    const value = values.get(entry.key)
    if (value === undefined) {
      throw new Error(`Missing value for ${entry.key}.`)
    }
    await setConvexEnv(options.deployment, entry.key, value)
    console.log(`Set ${entry.key}.`)
  }

  const cliToken = values.get("CLI_AUTH_TOKEN")
  if (cliToken !== undefined) {
    updateLocalCliToken(cliToken)
    console.log("Updated .env.local with CLI_AUTH_TOKEN.")
  } else if (existingKeys.has("CLI_AUTH_TOKEN")) {
    console.log(
      "CLI_AUTH_TOKEN already existed in Convex; .env.local was not changed."
    )
  }

  console.log(
    "\nDone. Next run: bun run auth <service> for each service you want to set up"
  )
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Error: ${message}`)
  process.exit(1)
}
