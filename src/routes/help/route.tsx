import { createFileRoute } from "@tanstack/react-router"
import { Page } from "@/components/layout/page"

/**
 * Some sections read live settings, and `useQuery` throws during render when
 * that read fails — a disabled account, or a token refresh landing mid-render.
 * The page is lost either way — this only replaces the router's default error
 * screen with something a reader can act on. Every help page inherits it.
 */
function HelpErrorPage() {
  return (
    <Page.Shell title="Help">
      <Page.Status
        variant="empty"
        message="Help is temporarily unavailable. Reload to try again."
      />
    </Page.Shell>
  )
}

export const Route = createFileRoute("/help")({
  errorComponent: HelpErrorPage,
})
