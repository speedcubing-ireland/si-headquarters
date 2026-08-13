import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { convex } from "@/lib/convex-client"
import { shouldHandleAuthCode } from "@/lib/auth-code-paths"
import { isSponsorSite } from "@/lib/sponsor-site"
import { createSponsorSiteRewrite } from "@/lib/sponsor-site-rewrite"
import {
  parseOAuthFriendlySearch,
  stringifyOAuthFriendlySearch,
} from "@/lib/oauth-friendly-search"
import "./index.css"

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  parseSearch: parseOAuthFriendlySearch,
  stringifySearch: stringifyOAuthFriendlySearch,
  ...(isSponsorSite() ? { rewrite: createSponsorSiteRewrite() } : {}),
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

const root = document.getElementById("root")
if (!root) {
  throw new Error("Root element not found")
}

createRoot(root).render(
  <StrictMode>
    <ConvexAuthProvider
      client={convex}
      shouldHandleCode={() =>
        shouldHandleAuthCode(router.state.location.pathname)
      }
      replaceURL={(url) => {
        router.history.replace(url)
      }}
    >
      <ThemeProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
        <Toaster />
      </ThemeProvider>
    </ConvexAuthProvider>
  </StrictMode>
)
