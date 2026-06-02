const HQ_TITLE_SUFFIX = "Headquarters | Speedcubing Ireland"

export function headquartersPageTitle(pageName: string): string {
  return `${pageName} | ${HQ_TITLE_SUFFIX}`
}

export function getPageTitle(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  if (normalized === "/sponsor" || normalized.startsWith("/sponsor/")) {
    return "Sponsors | Speedcubing Ireland"
  }
  if (normalized === "/tasks") {
    return headquartersPageTitle("Tasks")
  }
  const teamTasksMatch = /^\/teams\/[^/]+\/tasks$/.exec(normalized)
  if (teamTasksMatch !== null) {
    return headquartersPageTitle("Team Tasks")
  }
  return HQ_TITLE_SUFFIX
}
