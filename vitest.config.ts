import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@/convex": path.resolve(__dirname, "./convex"),
			"@": path.resolve(__dirname, "./src"),
		},
	},
	test: {
		isolate: true,
    // threads was causing issues on my mac...
		pool: "forks",
		testTimeout: 20_000,
		projects: [
			{
				extends: true,
				test: {
					name: "convex",
					dir: "convex",
					include: ["**/*.test.ts"],
					environment: "edge-runtime",
				},
			},
			{
				extends: true,
				test: {
					name: "frontend",
					dir: "src",
					include: ["**/*.test.ts"],
					environment: "node",
				},
			},
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary", "html"],
			exclude: ["coverage/**", "dist/**", "convex/_generated/**", "**/*.d.ts"],
		},
		server: {
			deps: {
				inline: ["convex-test", "zod", "@auth/core", "@convex-dev/auth"],
			},
		},
	},
});
