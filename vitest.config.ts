import { globSync, readFileSync } from "node:fs"
import path from "node:path"
import { configDefaults, defineConfig } from "vitest/config"

const testGlobs = [
  "config/**/*.test.{ts,tsx,js,jsx}",
  "convex/**/*.test.{ts,tsx,js,jsx}",
  "scripts/**/*.test.{ts,tsx,js,jsx}",
  "src/**/*.test.{ts,tsx,js,jsx}",
]

// Importing the full Convex backend graph (every module, plus auth deps) is the
// dominant cost in this suite. Under vitest's default isolation that graph is
// re-executed from scratch for every test file. Disabling isolation lets files
// share a worker's module registry, so the graph is imported once per worker
// instead of once per file — cutting total import time by ~7x.
//
// The catch: vi.mock relies on a fresh per-file module registry, so any test
// that mocks a module needs real isolation. We partition automatically by
// scanning for vi.mock, so new mocking tests are routed correctly with no
// manual list to maintain.
const mockingTests = globSync(testGlobs).filter((file) =>
  /\bvi\.mock\(/.test(readFileSync(file, "utf8"))
)

export default defineConfig({
  resolve: {
    alias: {
      // Tests always run against the all-features fixture manifest. The
      // production manifest in organisation-config.ts gates most features off;
      // tests assert the full catalog (plugin registries, task integrations,
      // env setup) so they target the fixture instead of coupling to whichever
      // features a given fork ships. Routing this here (rather than a per-file
      // vi.mock) means no test needs module isolation just to pick the manifest.
      "@/config/lib/organisation": path.resolve(
        __dirname,
        "./config/lib/organisation.testFixture.ts"
      ),
      "@/convex": path.resolve(__dirname, "./convex"),
      "@/config": path.resolve(__dirname, "./config"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "edge-runtime",
    setupFiles: ["./vitest.setup.ts"],
    // Test bodies here are cheap (tens of ms), but with isolate:false a worker
    // imports the full Convex graph (~150s aggregate) while other files' tests
    // run. That contention can starve a trivial test body past the default 5s,
    // producing flaky timeouts. Raise the ceiling so real hangs still fail but
    // import-starved bodies don't.
    testTimeout: 15000,
    projects: [
      {
        extends: true,
        test: {
          name: "fast",
          isolate: false,
          include: testGlobs,
          exclude: [...configDefaults.exclude, ...mockingTests],
        },
      },
      {
        extends: true,
        test: {
          name: "isolated",
          isolate: true,
          include: mockingTests,
        },
      },
    ],
  },
})
