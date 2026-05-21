import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	input: ["./openapi/wca.yaml", "./openapi/canva.yaml"],
	output: [
		{ path: "./convex/integrations/wca/client", entryFile: false },
		{ path: "./convex/integrations/canva/client", entryFile: false },
	],
	plugins: ["@hey-api/typescript", "@hey-api/sdk"],
});