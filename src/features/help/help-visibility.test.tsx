import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  ALL_HELP_SECTIONS,
  visibleHelpSections,
} from "@/features/help/help-content"
import {
  isHelpTargetVisible,
  VisibleHelpSectionsContext,
} from "@/features/help/help-visibility"
import { WeeklyRecordsEmail } from "@/features/help/sections/records"

describe("isHelpTargetVisible", () => {
  const withoutAdmin = visibleHelpSections(ALL_HELP_SECTIONS, [])
  const withSettings = visibleHelpSections(ALL_HELP_SECTIONS, ["settings"])

  it("finds a visible section, and a visible topic on it", () => {
    expect(isHelpTargetVisible(withoutAdmin, "records", undefined)).toBe(true)
    expect(isHelpTargetVisible(withoutAdmin, "records", "weekly-email")).toBe(
      true
    )
  })

  it("rejects a section or topic gated behind an Admin tab", () => {
    expect(isHelpTargetVisible(withoutAdmin, "admin", undefined)).toBe(false)
    expect(isHelpTargetVisible(withoutAdmin, "admin", "settings")).toBe(false)
    expect(isHelpTargetVisible(withSettings, "admin", "settings")).toBe(true)
    expect(isHelpTargetVisible(withSettings, "admin", "wca-phases")).toBe(false)
  })
})

describe("HelpTopicLink", () => {
  it("keeps the words but drops the link when its target is hidden", () => {
    const html = renderToStaticMarkup(
      <VisibleHelpSectionsContext
        value={visibleHelpSections(ALL_HELP_SECTIONS, [])}
      >
        <WeeklyRecordsEmail />
      </VisibleHelpSectionsContext>
    )

    expect(html).toContain("Admin → Settings")
    expect(html).not.toContain("<a")
  })
})
