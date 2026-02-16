import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	input: ["./openapi/wca.yaml", "./openapi/canva.yml"],
	output: [
		{ path: "./convex/services/wca/client", entryFile: false },
		{ path: "./convex/services/canva/client", entryFile: false },
	],
	plugins: ["@hey-api/typescript", "@hey-api/sdk"],
});
