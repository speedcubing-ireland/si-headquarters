import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@/convex": path.resolve(__dirname, "./convex"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "edge-runtime",
    include: [
      "convex/**/*.test.{ts,tsx,js,jsx}",
      "src/**/*.test.{ts,tsx,js,jsx}",
    ],
  },
})
