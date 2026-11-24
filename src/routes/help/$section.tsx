import { createFileRoute } from "@tanstack/react-router"
import { HelpSectionPage } from "@/features/help/help-page"

function HelpSectionRoute() {
  const { section } = Route.useParams()

  // Keyed so moving between sections starts the page afresh, rather than
  // carrying one section's reading position into the next.
  return <HelpSectionPage key={section} slug={section} />
}

export const Route = createFileRoute("/help/$section")({
  component: HelpSectionRoute,
})
