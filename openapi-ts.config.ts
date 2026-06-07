import { defineConfig } from "@hey-api/openapi-ts"

export default defineConfig([
  {
    input: "./openapi/wca.yaml",
    output: { path: "./convex/plugins/wca/openapiClient", entryFile: false },
    plugins: [
      "@hey-api/typescript",
      { name: "@hey-api/client-fetch", baseUrl: false },
      { name: "@hey-api/sdk", client: false },
    ],
  },
  {
    input: "./openapi/canva.yaml",
    output: { path: "./convex/plugins/canva/openapiClient", entryFile: false },
    plugins: ["@hey-api/typescript", "@hey-api/sdk"],
  },
])
