import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@/convex": path.resolve(__dirname, "./convex"),
      "@/config": path.resolve(__dirname, "./config"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "edge-runtime",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "config/**/*.test.{ts,tsx,js,jsx}",
      "convex/**/*.test.{ts,tsx,js,jsx}",
      "scripts/**/*.test.{ts,tsx,js,jsx}",
      "src/**/*.test.{ts,tsx,js,jsx}",
    ],
  },
})
