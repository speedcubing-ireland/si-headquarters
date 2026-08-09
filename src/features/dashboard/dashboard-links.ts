import { parseJson } from "@/lib/parsed-json"
import { z } from "zod"

export const DASHBOARD_ORIGIN = "https://dashboard.speedcubingireland.com"

const dashboardLinkIconSchema = z.enum([
  "identity-card",
  "calendar",
  "cube",
  "award",
])

const dashboardLinkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  icon: dashboardLinkIconSchema,
  href: z.string().regex(/^\/(?!\/)/),
  actionLabel: z.string().min(1),
})

const dashboardLinksResponseSchema = z.object({
  links: z.array(dashboardLinkSchema),
})

export type DashboardLink = z.infer<typeof dashboardLinkSchema>
export type DashboardLinkIcon = z.infer<typeof dashboardLinkIconSchema>

export function parseDashboardLinksResponse(body: string): DashboardLink[] {
  return dashboardLinksResponseSchema.parse(parseJson(body)).links
}

export async function loadDashboardLinks(): Promise<DashboardLink[]> {
  const response = await fetch(`${DASHBOARD_ORIGIN}/api/links`, {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error(
      `Dashboard links request failed (${String(response.status)})`
    )
  }

  return parseDashboardLinksResponse(await response.text())
}

export function dashboardLinkHref(link: DashboardLink): string {
  return new URL(link.href, DASHBOARD_ORIGIN).toString()
}
