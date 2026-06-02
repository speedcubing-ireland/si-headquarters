import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ConvexReactClient } from "convex/react"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { isSponsorSite } from "@/lib/sponsor-site"
import { createSponsorSiteRewrite } from "@/lib/sponsor-site-rewrite"
import { env } from "@/env"
import "./index.css"

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  ...(isSponsorSite() ? { rewrite: createSponsorSiteRewrite() } : {}),
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

const convex = new ConvexReactClient(env.VITE_CONVEX_URL)

const root = document.getElementById("root")
if (!root) {
  throw new Error("Root element not found")
}

createRoot(root).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <ThemeProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
        <Toaster />
      </ThemeProvider>
    </ConvexAuthProvider>
  </StrictMode>
)
