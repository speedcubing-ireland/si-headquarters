import { defineConfig } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import convexPlugin from "@convex-dev/eslint-plugin";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
	{
		languageOptions: {
			parser: tsParser,
			ecmaVersion: "latest",
			sourceType: "module",
			parserOptions: {
				project: ["./tsconfig.json", "./convex/tsconfig.json"],
				tsconfigRootDir: configDir,
			},
		},
	},
	{
		ignores: [
			"convex/**/*.test.ts",
			"convex/**/*.behavior.test.ts",
			"convex/**/*.logic.test.ts",
			"convex/**/*.security.test.ts",
			"convex/_generated/**",
			"convex/**/_generated/**",
			"convex/services/**/client/**",
		],
	},
	...convexPlugin.configs.recommended,
]);
