import { defineConfig } from "@hey-api/openapi-ts"

export default defineConfig([
  {
    input: "./openapi/wca.yaml",
    output: { path: "./convex/plugins/wca/openapiClient", entryFile: false },
    plugins: ["@hey-api/typescript", "@hey-api/sdk"],
  },
  {
    input: "./openapi/canva.yaml",
    output: { path: "./convex/plugins/canva/openapiClient", entryFile: false },
    plugins: ["@hey-api/typescript", "@hey-api/sdk"],
  },
])
