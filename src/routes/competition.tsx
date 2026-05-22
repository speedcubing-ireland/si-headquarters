import { CompetitionPage } from "@/features/competitions/competition-page"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/competition")({
  component: CompetitionPage,
})
