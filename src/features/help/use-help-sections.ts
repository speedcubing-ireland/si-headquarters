import { useMemo } from "react"
import { useAdminAccess } from "@/features/admin/use-admin-access"
import {
  HELP_SECTIONS,
  visibleHelpSections,
} from "@/features/help/help-content"

/**
 * The help sections this reader can see. Topics about Admin tabs appear once
 * the reader's abilities have loaded, so `isLoading` tells a missing section
 * apart from one that has not been allowed yet.
 */
export function useHelpSections() {
  const { tabs, isLoading } = useAdminAccess()

  const sections = useMemo(
    () => visibleHelpSections(HELP_SECTIONS, tabs),
    [tabs]
  )

  return { sections, isLoading }
}
