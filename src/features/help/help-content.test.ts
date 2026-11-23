import { describe, expect, it } from "vitest"
import {
  HELP_ANCHOR_SEPARATOR,
  helpTopicAnchor,
  legacyHelpHashTarget,
} from "@/features/help/help-anchors"
import {
  ALL_HELP_SECTIONS,
  findHelpSection,
  type HelpSection,
  HELP_SECTIONS,
  visibleHelpSections,
} from "@/features/help/help-content"

/**
 * Anchors are what contextual `?` links from the rest of the app point at, so a
 * duplicate quietly sends readers to the wrong place rather than failing.
 * Checked across every section, not just the enabled ones, so a clash cannot
 * hide behind a feature flag until some deployment turns it on.
 */
describe("help content", () => {
  it("gives every section a unique slug", () => {
    const slugs = ALL_HELP_SECTIONS.map((section) => section.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("gives every topic a unique anchor", () => {
    const anchors = ALL_HELP_SECTIONS.flatMap((section) =>
      section.topics.map((topic) => helpTopicAnchor(section.slug, topic.id))
    )

    expect(new Set(anchors).size).toBe(anchors.length)
  })

  it("keeps slugs and topic ids free of the anchor separator", () => {
    for (const section of ALL_HELP_SECTIONS) {
      expect(section.slug).not.toContain(HELP_ANCHOR_SEPARATOR)
      for (const topic of section.topics) {
        expect(topic.id).not.toContain(HELP_ANCHOR_SEPARATOR)
      }
    }
  })

  it("has no empty sections", () => {
    for (const section of HELP_SECTIONS) {
      expect(section.topics.length).toBeGreaterThan(0)
    }
  })

  it("finds each section by its slug", () => {
    for (const section of HELP_SECTIONS) {
      expect(findHelpSection(HELP_SECTIONS, section.slug)).toBe(section)
    }
    expect(findHelpSection(HELP_SECTIONS, "no-such-section")).toBeUndefined()
  })
})

describe("visibleHelpSections", () => {
  const sections: readonly HelpSection[] = ALL_HELP_SECTIONS
  const topicIds = (visible: readonly HelpSection[]) =>
    visible.flatMap((section) => section.topics.map((topic) => topic.id))
  const admin = (visible: readonly HelpSection[]) =>
    findHelpSection(visible, "admin")

  it("hides Admin topics from readers who cannot open those tabs", () => {
    const visible = visibleHelpSections(sections, [])

    expect(admin(visible)).toBeUndefined()
    expect(
      visible.every((section) =>
        section.topics.every((topic) => topic.adminTab === undefined)
      )
    ).toBe(true)
  })

  it("shows each Admin topic only with its tab", () => {
    expect(admin(visibleHelpSections(sections, ["settings"]))?.topics).toEqual([
      expect.objectContaining({ id: "settings" }),
    ])
    expect(
      admin(visibleHelpSections(sections, ["settings", "wcaPhases"]))?.topics
    ).toHaveLength(2)
  })

  it("leaves sections untouched when nothing in them is hidden", () => {
    const visible = visibleHelpSections(sections, ["settings", "wcaPhases"])

    expect(visible).toEqual(sections)
    expect(topicIds(visible)).toEqual(topicIds(sections))
    expect(findHelpSection(visible, "records")).toBe(
      findHelpSection(sections, "records")
    )
  })
})

describe("legacyHelpHashTarget", () => {
  it("sends a topic anchor to its section page, keeping the anchor", () => {
    expect(legacyHelpHashTarget("#competition-phases--not-moving")).toEqual({
      section: "competition-phases",
      hash: "competition-phases--not-moving",
    })
  })

  it("accepts a hash without its leading #", () => {
    expect(legacyHelpHashTarget("getting-started--status")).toEqual({
      section: "getting-started",
      hash: "getting-started--status",
    })
  })

  it("sends a section anchor to the top of its page", () => {
    expect(legacyHelpHashTarget("#records")).toEqual({
      section: "records",
      hash: undefined,
    })
  })

  it("leaves the overview alone without a hash", () => {
    expect(legacyHelpHashTarget("")).toBeNull()
    expect(legacyHelpHashTarget("#")).toBeNull()
  })
})
