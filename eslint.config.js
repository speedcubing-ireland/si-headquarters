import js from "@eslint/js"
import globals from "globals"
import convexPlugin from "@convex-dev/eslint-plugin"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist", "src/components/ui", "convex/_generated"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "react-refresh/only-export-components": [
        "error",
        { extraHOCs: ["createFileRoute"] },
      ],
    },
  },
  {
    files: ["convex/**/*.ts"],
    plugins: {
      "@convex-dev": convexPlugin,
    },
    rules: {
      "@convex-dev/import-wrong-runtime": "off",
      "@convex-dev/no-old-registered-function-syntax": "error",
      "@convex-dev/require-args-validator": "error",
      "@convex-dev/explicit-table-ids": "error",
      "@convex-dev/no-filter-in-query": "warn",
    },
  },
  {
    files: ["convex/sponsorship/emails/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
])
