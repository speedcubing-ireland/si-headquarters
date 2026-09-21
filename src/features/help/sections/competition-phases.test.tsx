import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"
import {
  WCA_MILESTONES,
  type WcaMilestone,
} from "@/convex/phases/wcaMilestones"
import type { LiveMappings } from "@/features/help/sections/competition-phase-model"
import {
  MilestoneMappingView,
  PhaseLadderView,
  WhyItDidNotMoveView,
} from "@/features/help/sections/competition-phases"

function mappingsWith(
  overrides: Partial<Record<WcaMilestone, string | null>>
): NonNullable<LiveMappings> {
  return WCA_MILESTONES.map((milestone) => ({
    milestone,
    phaseKey: overrides[milestone] ?? null,
  }))
}

/**
 * The mapping this deployment actually runs. It differs from the template
 * defaults in exactly the ways the page used to get wrong: `held` moves
 * nothing, `resultsPosted` reaches Post-Competition, and Completed is left with
 * no milestone at all.
 */
const PRODUCTION_MAPPINGS = mappingsWith({
  submitted: "pre-announcement",
  announced: "announced",
  refundDeadlinePassed: "pre-competition",
  resultsPosted: "post-competition",
})

const TEMPLATE_DEFAULT_MAPPINGS = mappingsWith({
  submitted: "pre-announcement",
  announced: "announced",
  refundDeadlinePassed: "pre-competition",
  held: "post-competition",
  resultsPosted: "completed",
})

/** Rendered text without the markup, so assertions read like the page does. */
function text(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}

/**
 * The text following a phrase, so a claim can be tied to the phase it is about
 * rather than merely being present somewhere on the page.
 */
function textAfter(html: string, phrase: string, length = 200): string {
  const rendered = text(html)
  const index = rendered.indexOf(phrase)
  expect(index, `"${phrase}" should be rendered`).toBeGreaterThan(-1)
  return rendered.slice(index, index + length)
}

describe("PhaseLadderView", () => {
  test("describes each phase by the live mapping, not the template", () => {
    const html = renderToStaticMarkup(
      <PhaseLadderView mappings={PRODUCTION_MAPPINGS} />
    )

    // The template says `held` reaches Post-Competition; production says
    // `resultsPosted` does. The page must follow production.
    expect(textAfter(html, "Post-Competition")).toContain("results posted")
    expect(text(html)).not.toContain("competition held")
  })

  test("reports a phase no milestone reaches as person-only", () => {
    const html = renderToStaticMarkup(
      <PhaseLadderView mappings={PRODUCTION_MAPPINGS} />
    )

    expect(textAfter(html, "Completed")).toContain("only a person can")
  })

  test("follows the template defaults when nothing is overridden", () => {
    const html = renderToStaticMarkup(
      <PhaseLadderView mappings={TEMPLATE_DEFAULT_MAPPINGS} />
    )

    expect(textAfter(html, "Post-Competition")).toContain("competition held")
    expect(textAfter(html, "Completed")).toContain("results posted")
  })

  /**
   * A gate is not a queue: `resolveBlockedPhaseIds` drops a blocked phase from
   * the candidates and the sync takes the furthest one left, so a competition
   * whose later milestones have landed never arrives at the gated phase. Copy
   * that says the sync "waits until" the gate clears would be a promise the
   * sync does not keep.
   */
  test("says a gated phase is skipped, not waited at", () => {
    const html = renderToStaticMarkup(
      <PhaseLadderView mappings={PRODUCTION_MAPPINGS} />
    )

    const gated = textAfter(html, "Pre-Announcement", 400)

    expect(gated).toContain("Concept")
    expect(gated).toContain("finished or cancelled")
    expect(gated).toContain("skips this phase rather than waiting")
  })

  test("states the gate even before the mapping arrives", () => {
    // The gate is template data, so withholding it while the mapping loads
    // would hide the commonest reason a competition has not moved.
    const html = renderToStaticMarkup(<PhaseLadderView mappings={undefined} />)

    expect(textAfter(html, "Pre-Announcement", 400)).toContain(
      "skips this phase rather than waiting"
    )
  })

  test("claims nothing about mappings while they are loading", () => {
    const html = renderToStaticMarkup(<PhaseLadderView mappings={undefined} />)

    // The structure is template data and renders at once...
    expect(text(html)).toContain("Concept")
    expect(text(html)).toContain("Post-Competition")
    // ...but no mapping claim is made either way.
    expect(text(html)).not.toContain("Reached when")
    expect(text(html)).not.toContain("only a person can")
  })
})

describe("MilestoneMappingView", () => {
  test("shows an unmapped milestone as moving nothing", () => {
    const html = renderToStaticMarkup(
      <MilestoneMappingView
        mappings={PRODUCTION_MAPPINGS}
        isCustomised={true}
      />
    )

    expect(textAfter(html, "Competition held")).toContain(
      "Does not move the competition on by itself."
    )
  })

  test("qualifies a milestone whose target phase is gated", () => {
    const html = renderToStaticMarkup(
      <MilestoneMappingView
        mappings={PRODUCTION_MAPPINGS}
        isCustomised={true}
      />
    )

    // `submitted` reaches Pre-Announcement only once Concept is settled, so
    // this row cannot state the move unconditionally.
    const outcome = textAfter(html, "Submitted to the WCA", 300)

    expect(outcome).toContain("Pre-Announcement")
    expect(outcome).toContain("Concept")
    expect(outcome).toContain("skips the phase")
  })

  test("leaves an ungated milestone unqualified", () => {
    const html = renderToStaticMarkup(
      <MilestoneMappingView
        mappings={PRODUCTION_MAPPINGS}
        isCustomised={true}
      />
    )

    const outcome = textAfter(html, "Announced (publicly visible)", 250)

    expect(outcome).toContain("Moves the competition to Announced.")
    expect(outcome).not.toContain("finished or cancelled")
  })

  test("flags a mapping pointing at a phase the template no longer has", () => {
    const html = renderToStaticMarkup(
      <MilestoneMappingView
        mappings={mappingsWith({ held: "phase-that-was-deleted" })}
        isCustomised={true}
      />
    )

    expect(textAfter(html, "Competition held")).toContain("no longer has")
    expect(textAfter(html, "Competition held")).not.toContain(
      "Does not move the competition on by itself."
    )
  })

  test("tells the reader whether a mapping has been saved over the default", () => {
    const customised = renderToStaticMarkup(
      <MilestoneMappingView
        mappings={PRODUCTION_MAPPINGS}
        isCustomised={true}
      />
    )
    const stock = renderToStaticMarkup(
      <MilestoneMappingView
        mappings={TEMPLATE_DEFAULT_MAPPINGS}
        isCustomised={false}
      />
    )

    // Saved is not the same as different — a director can save the defaults
    // unchanged — so the customised copy must not claim the mapping differs.
    expect(text(customised)).toContain("A director has saved it")
    expect(text(customised)).toContain("may differ")
    expect(text(stock)).toContain("Nothing has been saved over it")
  })

  test("does not guess at customisation while loading", () => {
    const html = renderToStaticMarkup(
      <MilestoneMappingView mappings={undefined} isCustomised={undefined} />
    )

    expect(text(html)).toContain("read from the app as you look at it")
    expect(text(html)).not.toContain("A director has saved it")
    expect(text(html)).not.toContain("Nothing has been saved over it")
  })
})

describe("WhyItDidNotMoveView", () => {
  test("names the phases no milestone currently reaches", () => {
    const html = renderToStaticMarkup(
      <WhyItDidNotMoveView mappings={PRODUCTION_MAPPINGS} />
    )

    expect(text(html)).toContain("Nothing maps to that phase.")
    expect(textAfter(html, "No milestone currently reaches")).toContain(
      "Concept"
    )
    expect(textAfter(html, "No milestone currently reaches")).toContain(
      "Completed"
    )
  })

  test("omits the bullet when every phase is reachable", () => {
    const everyPhaseMapped = mappingsWith({
      submitted: "concept",
      confirmed: "pre-announcement",
      announced: "announced",
      registrationClosed: "pre-competition",
      held: "post-competition",
      resultsPosted: "completed",
    })

    const html = renderToStaticMarkup(
      <WhyItDidNotMoveView mappings={everyPhaseMapped} />
    )

    expect(text(html)).not.toContain("Nothing maps to that phase.")
  })

  test("omits the computed bullet while loading", () => {
    const html = renderToStaticMarkup(
      <WhyItDidNotMoveView mappings={undefined} />
    )

    expect(text(html)).toContain("The sync only ever moves forward.")
    expect(text(html)).not.toContain("Nothing maps to that phase.")
  })
})
