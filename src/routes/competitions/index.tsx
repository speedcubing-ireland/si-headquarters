import { CompetitionsPage } from "@/features/competitions/list/competitions-page"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/competitions/")({
  component: CompetitionsPage,
})
