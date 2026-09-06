import { describe, expect, test } from "vitest"
import {
  mergeObservation,
  observeCompetition,
  reachedMilestones,
} from "@/convex/plugins/wca/competitionStatus"
import type {
  CompetitionIndex,
  MyCompetition,
} from "@/convex/plugins/wca/openapiClient/types.gen"
import type { WcaCompetitionStatus } from "@/convex/plugins/wca/validators"

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 5, 15)

function myCompetition(overrides: Partial<MyCompetition> = {}): MyCompetition {
  return {
    id: "SpringOpen2026",
    name: "Spring Open 2026",
    website: "",
    start_date: "2026-06-06",
    end_date: "2026-06-07",
    registration_open: "2026-04-01",
    url: "https://www.worldcubeassociation.org/competitions/SpringOpen2026",
    city: "Dublin",
    country_iso2: "IE",
    "results_posted?": false,
    "report_posted?": false,
    "visible?": true,
    "confirmed?": true,
    "cancelled?": false,
    short_display_name: "Spring Open 2026",
    championships: [],
    ...overrides,
  }
}

function competitionIndex(
  overrides: Partial<CompetitionIndex> = {}
): CompetitionIndex {
  return {
    id: "SpringOpen2026",
    name: "Spring Open 2026",
    short_display_name: "Spring Open 2026",
    start_date: "2026-06-06",
    end_date: "2026-06-07",
    registration_open: "2026-04-01T12:00:00.000Z",
    registration_close: "2026-05-20T12:00:00.000Z",
    announced_at: "2026-03-01T12:00:00.000Z",
    country_iso2: "IE",
    city: "Dublin",
    venue: "Somewhere",
    latitude_degrees: 0,
    longitude_degrees: 0,
    event_ids: ["333"],
    main_event_id: "333",
    competitor_limit: 100,
    championship_types: [],
    ...overrides,
  }
}

function status(
  overrides: Partial<WcaCompetitionStatus> = {}
): WcaCompetitionStatus {
  return {
    wcaCompetitionId: "SpringOpen2026",
    confirmed: false,
    announced: false,
    cancelled: false,
    resultsPosted: false,
    startDate: "2026-06-06",
    endDate: "2026-06-07",
    registrationCloseAt: null,
    fetchedAt: NOW,
    ...overrides,
  }
}

describe("observeCompetition", () => {
  test("takes the flags from `mine` and registration close from the index", () => {
    const result = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: myCompetition(),
      index: competitionIndex(),
      fetchedAt: NOW,
    })

    expect(result).toMatchObject({
      confirmed: true,
      announced: true,
      cancelled: false,
      resultsPosted: false,
      registrationCloseAt: Date.parse("2026-05-20T12:00:00.000Z"),
    })
  })

  test("`mine` wins over the index for announcement", () => {
    // The index only lists announced competitions, but `mine` is authoritative:
    // a competition it reports as not visible has not been announced.
    const result = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: myCompetition({ "visible?": false }),
      index: competitionIndex(),
      fetchedAt: NOW,
    })

    expect(result.announced).toBe(false)
  })

  test("falls back to the index when the service account is not on the competition", () => {
    const result = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: undefined,
      index: competitionIndex({ results_posted_at: "2026-06-09T10:00:00Z" }),
      fetchedAt: NOW,
    })

    expect(result).toMatchObject({
      announced: true,
      resultsPosted: true,
      // Only `mine` knows these, and it did not answer this run.
      confirmed: null,
      cancelled: null,
    })
  })

  test("reads cancellation from `mine`", () => {
    const result = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: myCompetition({ "cancelled?": true }),
      index: undefined,
      fetchedAt: NOW,
    })

    expect(result.cancelled).toBe(true)
  })

  test("registration close is unknown without the index", () => {
    const result = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: myCompetition(),
      index: undefined,
      fetchedAt: NOW,
    })

    expect(result.registrationCloseAt).toBeNull()
  })
})

describe("mergeObservation", () => {
  test("keeps a cancellation the current run could not confirm", () => {
    // The index carries no cancellation field, so a competition visible only
    // there must not be treated as reinstated.
    const previous = status({ announced: true, cancelled: true })
    const observation = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: undefined,
      index: competitionIndex(),
      fetchedAt: NOW,
    })

    expect(mergeObservation(previous, observation).cancelled).toBe(true)
  })

  test("applies a cancellation `mine` does report", () => {
    const previous = status({ announced: true, cancelled: true })
    const observation = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: myCompetition({ "cancelled?": false }),
      index: undefined,
      fetchedAt: NOW,
    })

    expect(mergeObservation(previous, observation).cancelled).toBe(false)
  })

  test("keeps a known registration close when the index is unavailable", () => {
    const closeAt = Date.UTC(2026, 4, 20)
    const previous = status({ announced: true, registrationCloseAt: closeAt })
    const observation = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: myCompetition(),
      index: undefined,
      fetchedAt: NOW,
    })

    expect(mergeObservation(previous, observation).registrationCloseAt).toBe(
      closeAt
    )
  })

  test("defaults unknown facts to false with nothing stored", () => {
    const observation = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: undefined,
      index: competitionIndex(),
      fetchedAt: NOW,
    })

    expect(mergeObservation(null, observation)).toMatchObject({
      confirmed: false,
      cancelled: false,
      announced: true,
    })
  })

  test("takes the observation's own values where it has them", () => {
    const previous = status({ announced: false, resultsPosted: false })
    const observation = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: myCompetition({ "results_posted?": true }),
      index: undefined,
      fetchedAt: NOW + 1,
    })

    expect(mergeObservation(previous, observation)).toMatchObject({
      announced: true,
      resultsPosted: true,
      fetchedAt: NOW + 1,
    })
  })
})

describe("reachedMilestones", () => {
  test("a competition we can see at all counts as submitted", () => {
    expect([...reachedMilestones(status(), NOW)]).toEqual(["submitted"])
  })

  test("reports only what the WCA actually says, gaps included", () => {
    // The WCA can report a later milestone without an earlier one. Those gaps
    // are reported honestly rather than filled in, because the competition page
    // shows this set to a human.
    const reached = reachedMilestones(
      status({ confirmed: false, announced: true, endDate: "2026-01-01" }),
      NOW
    )

    expect([...reached]).toEqual(["submitted", "announced", "held"])
  })

  test("returns milestones in ladder order regardless of how they were set", () => {
    const reached = reachedMilestones(
      status({ confirmed: true, announced: true, resultsPosted: true }),
      NOW
    )

    expect([...reached]).toEqual([
      "submitted",
      "confirmed",
      "announced",
      "held",
      "resultsPosted",
    ])
  })

  test("registration close only counts once it has passed", () => {
    const closeAt = Date.UTC(2026, 5, 20)

    expect(
      reachedMilestones(
        status({ announced: true, registrationCloseAt: closeAt }),
        closeAt - 1
      ).has("registrationClosed")
    ).toBe(false)

    expect(
      reachedMilestones(
        status({ announced: true, registrationCloseAt: closeAt }),
        closeAt
      ).has("registrationClosed")
    ).toBe(true)
  })

  test("held only counts once the last day is over", () => {
    const held = status({ announced: true, endDate: "2026-06-07" })
    const lastDay = Date.UTC(2026, 5, 7)

    // Still the final day of the competition.
    expect(reachedMilestones(held, lastDay + 1000).has("held")).toBe(false)
    expect(reachedMilestones(held, lastDay + DAY_MS).has("held")).toBe(true)
  })

  test("a competition still to be held has not reached `held`", () => {
    const upcoming = status({ announced: true, endDate: "2026-12-06" })

    expect(reachedMilestones(upcoming, NOW).has("held")).toBe(false)
  })

  test("a competition the WCA never announced is not treated as held", () => {
    // Its pencilled-in date passing is not the same as it having happened.
    const reached = reachedMilestones(
      status({ announced: false, endDate: "2026-01-01" }),
      NOW
    )

    expect(reached.has("held")).toBe(false)
    expect([...reached]).toEqual(["submitted"])
  })

  test("cancellation does not appear on the ladder", () => {
    const reached = reachedMilestones(
      status({
        confirmed: true,
        announced: true,
        cancelled: true,
        endDate: "2026-12-01",
      }),
      NOW
    )

    expect([...reached]).toEqual(["submitted", "confirmed", "announced"])
  })
})
