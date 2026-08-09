import { parseJson } from "@/lib/parsed-json"
import { z } from "zod"

export const DASHBOARD_ORIGIN = "https://dashboard.speedcubingireland.com"
const DASHBOARD_REQUEST_TIMEOUT_MS = 10_000
const MAX_DASHBOARD_LINKS = 30

const dashboardLinkIconSchema = z.enum([
  "identity-card",
  "calendar",
  "cube",
  "award",
])

const dashboardLinkSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  icon: dashboardLinkIconSchema,
  href: z
    .string()
    .max(2_000)
    .regex(/^\/(?!\/)/),
  actionLabel: z.string().min(1).max(100),
})

const dashboardLinksResponseSchema = z.object({
  links: z
    .array(dashboardLinkSchema)
    .max(MAX_DASHBOARD_LINKS)
    .refine(
      (links) => new Set(links.map((link) => link.id)).size === links.length,
      "Dashboard link ids must be unique"
    ),
})

export type DashboardLink = z.infer<typeof dashboardLinkSchema>
export type DashboardLinkIcon = z.infer<typeof dashboardLinkIconSchema>

export function parseDashboardLinksResponse(body: string): DashboardLink[] {
  return dashboardLinksResponseSchema.parse(parseJson(body)).links
}

export async function loadDashboardLinks(): Promise<DashboardLink[]> {
  const response = await fetch(`${DASHBOARD_ORIGIN}/api/links`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(DASHBOARD_REQUEST_TIMEOUT_MS),
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
