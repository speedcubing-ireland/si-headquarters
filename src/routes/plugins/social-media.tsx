import { createFileRoute } from "@tanstack/react-router"
import { SocialMediaPage } from "@/plugins/social-media/social-media-page"

export const Route = createFileRoute("/plugins/social-media")({
  component: SocialMediaPage,
})
