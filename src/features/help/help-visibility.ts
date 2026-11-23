import { createContext, useContext } from "react"
import type { HelpSection } from "@/features/help/help-content"

/**
 * The sections the current reader can see, provided by the page that renders
 * topic bodies. Kept apart from the registry, like the anchors, so prose
 * components can read it without importing the registry that imports them.
 * `null` means no page has said, and every link is taken as reachable.
 */
export const VisibleHelpSectionsContext = createContext<
  readonly HelpSection[] | null
>(null)

/** Whether a section, or a topic on it, is one the reader can open. */
export function isHelpTargetVisible(
  sections: readonly HelpSection[],
  sectionSlug: string,
  topicId: string | undefined
): boolean {
  const section = sections.find((item) => item.slug === sectionSlug)
  if (section === undefined) return false
  return (
    topicId === undefined || section.topics.some((item) => item.id === topicId)
  )
}

/**
 * Whether a help link would land the reader somewhere they can read. A topic
 * linking to one gated on a feature or an Admin tab the reader lacks would
 * otherwise send them to "not one you can see".
 */
export function useIsHelpTargetVisible(
  sectionSlug: string,
  topicId: string | undefined
): boolean {
  const sections = useContext(VisibleHelpSectionsContext)
  return (
    sections === null || isHelpTargetVisible(sections, sectionSlug, topicId)
  )
}
