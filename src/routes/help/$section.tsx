import { createFileRoute } from "@tanstack/react-router"
import { HelpSectionPage } from "@/features/help/help-page"
import { HelpErrorPage } from "./-help-error"

function HelpSectionRoute() {
  const { section } = Route.useParams()

  return <HelpSectionPage slug={section} />
}

export const Route = createFileRoute("/help/$section")({
  component: HelpSectionRoute,
  errorComponent: HelpErrorPage,
})
