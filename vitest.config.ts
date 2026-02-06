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
		environment: "edge-runtime",
		include: ["convex/**/*.test.ts", "src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary", "html"],
			exclude: ["coverage/**", "dist/**", "convex/_generated/**", "**/*.d.ts"],
			thresholds: {
				statements: 45,
				branches: 36,
				functions: 45,
				lines: 45,
				"convex/tasks.ts": {
					statements: 42,
					branches: 30,
					functions: 32,
					lines: 43,
				},
				"convex/notifications.ts": {
					statements: 18,
					branches: 10,
					functions: 20,
					lines: 18,
				},
			},
		},
		server: {
			deps: {
				inline: ["convex-test"],
			},
		},
	},
});
