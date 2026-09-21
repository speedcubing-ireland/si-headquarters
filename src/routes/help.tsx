import { createFileRoute } from "@tanstack/react-router"
import { Page } from "@/components/layout/page"
import { HelpPage } from "@/features/help/help-page"

/**
 * The phases section reads the live WCA mapping, and `useQuery` throws during
 * render when that read fails — a disabled account, or a token refresh landing
 * mid-render. The page is lost either way — this only replaces the router's
 * default error screen with something a reader can act on.
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
  component: HelpPage,
  errorComponent: HelpErrorPage,
})
