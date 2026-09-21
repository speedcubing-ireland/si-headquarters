import { describe, expect, it } from "vitest"
import { HELP_SECTIONS, helpTopicAnchor } from "@/features/help/help-content"

/**
 * Anchors are what contextual `?` links from the rest of the app point at, so a
 * duplicate quietly sends readers to the wrong place rather than failing.
 */
describe("help content", () => {
  it("gives every section a unique slug", () => {
    const slugs = HELP_SECTIONS.map((section) => section.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("gives every topic a unique anchor", () => {
    const anchors = HELP_SECTIONS.flatMap((section) =>
      section.topics.map((topic) => helpTopicAnchor(section.slug, topic.id))
    )

    expect(new Set(anchors).size).toBe(anchors.length)
  })

  it("has no empty sections", () => {
    for (const section of HELP_SECTIONS) {
      expect(section.topics.length).toBeGreaterThan(0)
    }
  })
})
