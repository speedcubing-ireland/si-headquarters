import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ConvexReactClient } from "convex/react"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { STAFF_WCA_LOGIN_PATH } from "@/convex/wcaLogin/wcaLoginPaths"
import { isSponsorSite } from "@/lib/sponsor-site"
import { createSponsorSiteRewrite } from "@/lib/sponsor-site-rewrite"
import { ORGANISER_INVITE_PATH } from "@/convex/competitions/invites/validators"
import {
  parseOAuthFriendlySearch,
  stringifyOAuthFriendlySearch,
} from "@/lib/oauth-friendly-search"
import { env } from "@/env"
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

const convex = new ConvexReactClient(env.VITE_CONVEX_URL)

const root = document.getElementById("root")
if (!root) {
  throw new Error("Root element not found")
}

createRoot(root).render(
  <StrictMode>
    <ConvexAuthProvider
      client={convex}
      shouldHandleCode={() => {
        const pathname =
          router.state.location.pathname.replace(/\/+$/, "") || "/"
        return (
          pathname !== ORGANISER_INVITE_PATH &&
          pathname !== STAFF_WCA_LOGIN_PATH
        )
      }}
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
