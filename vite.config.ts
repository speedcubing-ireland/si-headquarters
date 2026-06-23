import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { defineConfig, loadEnv } from "vite"
import { createClientEnv } from "./src/env.schema"

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_")
  createClientEnv({
    VITE_CONVEX_URL: loadedEnv.VITE_CONVEX_URL,
    VITE_CONVEX_SITE_URL: loadedEnv.VITE_CONVEX_SITE_URL,
    VITE_SPONSOR_SITE: loadedEnv.VITE_SPONSOR_SITE,
  })

  return {
    plugins: [
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@/convex": path.resolve(__dirname, "./convex"),
        "@/config": path.resolve(__dirname, "./config"),
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
