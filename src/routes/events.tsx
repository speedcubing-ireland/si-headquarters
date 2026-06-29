import { createFileRoute } from "@tanstack/react-router"
import { EventsPage } from "@/features/events/events-page"
import { AbilityRouteGuard } from "@/features/auth"

export const Route = createFileRoute("/events")({
  component: EventsRoute,
})

function EventsRoute() {
  return (
    <AbilityRouteGuard
      action="access"
      subject="EventsDashboard"
      deniedMessage="Volunteer or Competitions Team access is required."
      loadingMessage="Loading Events…"
    >
      <EventsPage />
    </AbilityRouteGuard>
  )
}
