import { defineConfig } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import convexPlugin from "@convex-dev/eslint-plugin";

export default defineConfig([
	{
		languageOptions: {
			parser: tsParser,
			ecmaVersion: "latest",
			sourceType: "module",
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
