import { createFileRoute, Navigate, useLocation } from "@tanstack/react-router"
import { legacyHelpHashTarget } from "@/features/help/help-content"
import { HelpOverview } from "@/features/help/help-page"
import { HelpErrorPage } from "./-help-error"

/**
 * Help used to be one page, so older links point at `/help#<topic>`. Send them
 * to the section page that now holds the topic.
 */
function HelpIndexRoute() {
  const { hash } = useLocation()
  const target = legacyHelpHashTarget(hash)

  return target === null ? (
    <HelpOverview />
  ) : (
    <Navigate
      to="/help/$section"
      params={{ section: target.section }}
      hash={target.hash}
      replace
    />
  )
}

export const Route = createFileRoute("/help/")({
  component: HelpIndexRoute,
  errorComponent: HelpErrorPage,
})
