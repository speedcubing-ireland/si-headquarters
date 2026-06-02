import js from "@eslint/js"
import globals from "globals"
import convexPlugin from "@convex-dev/eslint-plugin"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

const strictTypeRules = {
  "@typescript-eslint/consistent-type-assertions": [
    "error",
    { assertionStyle: "never" },
  ],
  "@typescript-eslint/consistent-type-exports": "error",
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/no-import-type-side-effects": "error",
  "@typescript-eslint/no-restricted-types": [
    "error",
    {
      types: {
        unknown: {
          message:
            "Use a specific type or validate/narrow at the boundary before passing data through.",
        },
      },
    },
  ],
  "@typescript-eslint/strict-boolean-expressions": "error",
  "@typescript-eslint/switch-exhaustiveness-check": "error",
}

export default defineConfig([
  globalIgnores([
    "dist",
    "src/components/ui",
    "convex/**/_generated",
    "convex/plugins/**/openapiClient",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "react-refresh/only-export-components": [
        "error",
        { extraHOCs: ["createFileRoute", "createRootRoute"] },
      ],
      ...strictTypeRules,
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
      ...strictTypeRules,
    },
  },
  {
    files: ["convex/plugins/sponsor/emails/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": "off",
      "@typescript-eslint/no-restricted-types": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    files: ["src/features/tasks/list/task-list-parse.ts"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": "off",
    },
  },
  {
    files: ["convex/plugins/core/jsonBoundary.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
  {
    files: ["scripts/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
])
