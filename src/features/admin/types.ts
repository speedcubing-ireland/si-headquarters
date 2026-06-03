export const ADMIN_TABS = ["users", "impersonation"] as const

export type AdminTab = (typeof ADMIN_TABS)[number]

export function isAdminTab(value: string): value is AdminTab {
  return ADMIN_TABS.some((tab) => tab === value)
}
