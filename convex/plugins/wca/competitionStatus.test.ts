import { describe, expect, test } from "vitest"
import type { MilestoneGates } from "@/convex/phases/milestoneGates"
import {
  mergeObservation,
  needsRefundDeadline,
  observeCompetition,
  parseDeadlinePassedAt,
  reachedMilestones,
  withRefundDeadline,
} from "@/convex/plugins/wca/competitionStatus"
import type {
  CompetitionIndex,
  MyCompetition,
} from "@/convex/plugins/wca/openapiClient/types.gen"
import { sampleCompetitionInfo } from "@/convex/plugins/wca/testFixtures"
import type {
  WcaCompetitionObservation,
  WcaCompetitionStatus,
} from "@/convex/plugins/wca/validators"

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 5, 15)

/**
 * The gates every test about the WCA's own facts uses. Held rather than open so
 * those tests keep asserting exactly the milestones the WCA accounts for, and
 * `conceptTasksComplete` stays the subject of its own tests below.
 */
const CONCEPT_HELD: MilestoneGates = { conceptTasksComplete: false }
const CONCEPT_DONE: MilestoneGates = { conceptTasksComplete: true }

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
    refundDeadlineAt: null,
    fetchedAt: NOW,
    ...overrides,
  }
}

/** A competition observed as announced, uncancelled and yet to be held. */
function inWindowObservation(
  overrides: Partial<WcaCompetitionObservation> = {}
): WcaCompetitionObservation {
  return {
    ...status({ announced: true, endDate: "2026-12-06" }),
    // An observation is always built fresh, so it never omits this.
    refundDeadlineAt: null,
    confirmed: true,
    cancelled: false,
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
    expect([...reachedMilestones(status(), NOW, CONCEPT_HELD)]).toEqual([
      "submitted",
    ])
  })

  test("being on the WCA is not enough for the concept tasks milestone", () => {
    // The whole point of the rung: the competition exists on the WCA, but the
    // concept work behind it is still outstanding.
    const reached = reachedMilestones(status(), NOW, CONCEPT_HELD)

    expect(reached.has("submitted")).toBe(true)
    expect(reached.has("conceptTasksComplete")).toBe(false)
  })

  test("the concept tasks milestone needs both the WCA and the tasks", () => {
    expect([...reachedMilestones(status(), NOW, CONCEPT_DONE)]).toEqual([
      "submitted",
      "conceptTasksComplete",
    ])
  })

  test("the concept gate holds only its own rung", () => {
    // A held gate must not hold back a competition the WCA has already taken
    // further — those rungs are the WCA's facts, not ours.
    const wcaState = status({
      confirmed: true,
      announced: true,
      resultsPosted: true,
    })

    const held = reachedMilestones(wcaState, NOW, CONCEPT_HELD)
    const done = reachedMilestones(wcaState, NOW, CONCEPT_DONE)

    expect([...held]).toEqual([
      "submitted",
      "confirmed",
      "announced",
      "held",
      "resultsPosted",
    ])
    expect([...done]).toEqual([
      "submitted",
      "conceptTasksComplete",
      "confirmed",
      "announced",
      "held",
      "resultsPosted",
    ])
  })

  test("reports only what the WCA actually says, gaps included", () => {
    // The WCA can report a later milestone without an earlier one. Those gaps
    // are reported honestly rather than filled in, because the competition page
    // shows this set to a human.
    const reached = reachedMilestones(
      status({ confirmed: false, announced: true, endDate: "2026-01-01" }),
      NOW,
      CONCEPT_HELD
    )

    expect([...reached]).toEqual(["submitted", "announced", "held"])
  })

  test("returns milestones in ladder order regardless of how they were set", () => {
    const reached = reachedMilestones(
      status({ confirmed: true, announced: true, resultsPosted: true }),
      NOW,
      CONCEPT_HELD
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
        closeAt - 1,
        CONCEPT_HELD
      ).has("registrationClosed")
    ).toBe(false)

    expect(
      reachedMilestones(
        status({ announced: true, registrationCloseAt: closeAt }),
        closeAt,
        CONCEPT_HELD
      ).has("registrationClosed")
    ).toBe(true)
  })

  test("held only counts once the last day is over", () => {
    const held = status({ announced: true, endDate: "2026-06-07" })
    const lastDay = Date.UTC(2026, 5, 7)

    // Still the final day of the competition.
    expect(
      reachedMilestones(held, lastDay + 1000, CONCEPT_HELD).has("held")
    ).toBe(false)
    expect(
      reachedMilestones(held, lastDay + DAY_MS, CONCEPT_HELD).has("held")
    ).toBe(true)
  })

  test("a competition still to be held has not reached `held`", () => {
    const upcoming = status({ announced: true, endDate: "2026-12-06" })

    expect(reachedMilestones(upcoming, NOW, CONCEPT_HELD).has("held")).toBe(
      false
    )
  })

  test("a competition the WCA never announced is not treated as held", () => {
    // Its pencilled-in date passing is not the same as it having happened.
    const reached = reachedMilestones(
      status({ announced: false, endDate: "2026-01-01" }),
      NOW,
      CONCEPT_HELD
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
      NOW,
      CONCEPT_HELD
    )

    expect([...reached]).toEqual(["submitted", "confirmed", "announced"])
  })
})

describe("parseDeadlinePassedAt", () => {
  test("a date-only deadline shuts at the end of that day", () => {
    // Refunds are still allowed *on* the limit date, so the deadline has not
    // passed until the day itself is over.
    expect(parseDeadlinePassedAt("2026-05-25")).toBe(
      Date.UTC(2026, 4, 25) + DAY_MS
    )
  })

  test("a deadline carrying a time is taken at that instant", () => {
    expect(parseDeadlinePassedAt("2026-05-25T17:00:00Z")).toBe(
      Date.parse("2026-05-25T17:00:00Z")
    )
  })

  test("an offset is respected rather than treated as UTC", () => {
    expect(parseDeadlinePassedAt("2026-05-25T18:00:00+01:00")).toBe(
      Date.parse("2026-05-25T17:00:00Z")
    )
  })

  test("rolls over a month boundary", () => {
    expect(parseDeadlinePassedAt("2026-12-31")).toBe(Date.UTC(2027, 0, 1))
  })

  test("handles a leap day", () => {
    expect(parseDeadlinePassedAt("2028-02-29")).toBe(Date.UTC(2028, 2, 1))
  })

  test("surrounding whitespace does not change the reading", () => {
    expect(parseDeadlinePassedAt("  2026-05-25  ")).toBe(
      Date.UTC(2026, 4, 25) + DAY_MS
    )
  })

  test.each([
    ["absent", undefined],
    ["empty", ""],
    ["whitespace only", "   "],
    ["unparseable", "not a date"],
  ])("%s reads as unknown", (_label, value) => {
    expect(parseDeadlinePassedAt(value)).toBeNull()
  })
})

describe("needsRefundDeadline", () => {
  test("an announced competition still to be held is in window", () => {
    expect(needsRefundDeadline(inWindowObservation(), null, NOW)).toBe(true)
  })

  test("an unannounced competition is not worth a request", () => {
    // It has no public registration yet, so no refund window to close.
    expect(
      needsRefundDeadline(inWindowObservation({ announced: false }), null, NOW)
    ).toBe(false)
  })

  test("a cancelled competition is not worth a request", () => {
    expect(
      needsRefundDeadline(inWindowObservation({ cancelled: true }), null, NOW)
    ).toBe(false)
  })

  test("a competition whose cancellation is unknown is still in window", () => {
    // `null` means the source could not say, which is not a cancellation.
    expect(
      needsRefundDeadline(inWindowObservation({ cancelled: null }), null, NOW)
    ).toBe(true)
  })

  test("a competition already held is not worth a request", () => {
    expect(
      needsRefundDeadline(
        inWindowObservation({ endDate: "2026-01-01" }),
        null,
        NOW
      )
    ).toBe(false)
  })

  test("the window closes only once the last day is over", () => {
    const observation = inWindowObservation({ endDate: "2026-06-07" })
    const lastDay = Date.UTC(2026, 5, 7)

    expect(needsRefundDeadline(observation, null, lastDay + 1000)).toBe(true)
    expect(needsRefundDeadline(observation, null, lastDay + DAY_MS)).toBe(false)
  })

  test("a stored deadline that has passed needs no further request", () => {
    // The milestone cannot un-reach, so re-fetching would learn nothing. This
    // is the whole gap between a refund window shutting and the competition
    // being held — weeks of hourly requests, for most competitions.
    expect(needsRefundDeadline(inWindowObservation(), NOW - 1, NOW)).toBe(false)
  })

  test("a stored deadline still ahead of us is re-fetched", () => {
    // Organisers edit the refund policy limit date, so it is not final.
    expect(needsRefundDeadline(inWindowObservation(), NOW + 1, NOW)).toBe(true)
  })

  test("an unknown end date cannot rule the window out", () => {
    // Guessing "over" would leave the competition permanently without a
    // deadline, and so permanently unable to reach the milestone.
    expect(
      needsRefundDeadline(inWindowObservation({ endDate: null }), null, NOW)
    ).toBe(true)
  })
})

describe("reachedMilestones — refund deadline", () => {
  const CLOSE_AT = Date.UTC(2026, 4, 20)
  const DEADLINE_AT = Date.UTC(2026, 4, 25)

  function refundStatus(
    registrationCloseAt: number | null,
    refundDeadlineAt: number | null
  ): WcaCompetitionStatus {
    return status({
      announced: true,
      endDate: "2026-12-06",
      registrationCloseAt,
      refundDeadlineAt,
    })
  }

  test("both conditions met reaches the milestone", () => {
    const reached = reachedMilestones(
      refundStatus(CLOSE_AT, DEADLINE_AT),
      DEADLINE_AT,
      CONCEPT_HELD
    )

    expect(reached.has("refundDeadlinePassed")).toBe(true)
  })

  test("registration closed but refunds still open does not", () => {
    // The case this whole change exists for: today's behaviour would already
    // have moved the competition into Pre-Competition here.
    const reached = reachedMilestones(
      refundStatus(CLOSE_AT, DEADLINE_AT),
      DEADLINE_AT - 1,
      CONCEPT_HELD
    )

    expect(reached.has("registrationClosed")).toBe(true)
    expect(reached.has("refundDeadlinePassed")).toBe(false)
  })

  test("a refund deadline that precedes registration close does not count", () => {
    // The WCA does not stop an organiser setting a refund limit date before
    // registration shuts, and "either" is not what we asked for.
    const reached = reachedMilestones(
      refundStatus(DEADLINE_AT + DAY_MS, DEADLINE_AT),
      DEADLINE_AT + 1,
      CONCEPT_HELD
    )

    expect(reached.has("registrationClosed")).toBe(false)
    expect(reached.has("refundDeadlinePassed")).toBe(false)
  })

  test("an unknown deadline holds rather than advancing", () => {
    const reached = reachedMilestones(
      refundStatus(CLOSE_AT, null),
      NOW,
      CONCEPT_HELD
    )

    expect(reached.has("registrationClosed")).toBe(true)
    expect(reached.has("refundDeadlinePassed")).toBe(false)
  })

  test("a row written before the deadline was tracked holds", () => {
    // Rows predating the field omit it entirely rather than storing null.
    const legacy = refundStatus(CLOSE_AT, null)
    delete (legacy as { refundDeadlineAt?: number | null }).refundDeadlineAt

    expect(
      reachedMilestones(legacy, NOW, CONCEPT_HELD).has("refundDeadlinePassed")
    ).toBe(false)
  })

  test("the deadline passes at the instant itself, not after it", () => {
    const reached = (nowMs: number) =>
      reachedMilestones(
        refundStatus(CLOSE_AT, DEADLINE_AT),
        nowMs,
        CONCEPT_HELD
      )

    expect(reached(DEADLINE_AT - 1).has("refundDeadlinePassed")).toBe(false)
    expect(reached(DEADLINE_AT).has("refundDeadlinePassed")).toBe(true)
  })

  test("is reached in exactly the cells where both dates are known and past", () => {
    // The whole truth table, not just the implication: asserting every cell
    // means a rung that stops being reached at all cannot pass silently.
    const dates = [
      ["unknown", null],
      ["closed", CLOSE_AT],
      ["deadline", DEADLINE_AT],
    ] as const

    const table = dates.flatMap(([closeLabel, registrationCloseAt]) =>
      dates.map(([refundLabel, refundDeadlineAt]) => {
        const reached = reachedMilestones(
          refundStatus(registrationCloseAt, refundDeadlineAt),
          DEADLINE_AT,
          CONCEPT_HELD
        )
        return `close=${closeLabel} refund=${refundLabel} -> ${
          reached.has("refundDeadlinePassed") ? "reached" : "held"
        }`
      })
    )

    expect(table).toEqual([
      "close=unknown refund=unknown -> held",
      "close=unknown refund=closed -> held",
      "close=unknown refund=deadline -> held",
      "close=closed refund=unknown -> held",
      "close=closed refund=closed -> reached",
      "close=closed refund=deadline -> reached",
      "close=deadline refund=unknown -> held",
      "close=deadline refund=closed -> reached",
      "close=deadline refund=deadline -> reached",
    ])
  })

  test("sits between registration close and held on the ladder", () => {
    const reached = reachedMilestones(
      status({
        confirmed: true,
        announced: true,
        endDate: "2026-01-01",
        registrationCloseAt: CLOSE_AT,
        refundDeadlineAt: DEADLINE_AT,
      }),
      NOW,
      CONCEPT_HELD
    )

    expect([...reached]).toEqual([
      "submitted",
      "confirmed",
      "announced",
      "registrationClosed",
      "refundDeadlinePassed",
      "held",
    ])
  })

  test("an unknown deadline never stalls a competition that was held", () => {
    // `held` is reached on its own, so a competition whose detail we could
    // never fetch still moves on to Post-Competition.
    const reached = reachedMilestones(
      status({
        announced: true,
        endDate: "2026-01-01",
        registrationCloseAt: CLOSE_AT,
        refundDeadlineAt: null,
      }),
      NOW,
      CONCEPT_HELD
    )

    expect(reached.has("refundDeadlinePassed")).toBe(false)
    expect(reached.has("held")).toBe(true)
  })
})

describe("mergeObservation — refund deadline", () => {
  const DEADLINE_AT = Date.UTC(2026, 4, 26)

  test("keeps a known deadline through a run that fetched no detail", () => {
    const previous = status({
      announced: true,
      refundDeadlineAt: DEADLINE_AT,
    })
    const observation = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: myCompetition(),
      index: competitionIndex(),
      fetchedAt: NOW,
    })

    expect(mergeObservation(previous, observation).refundDeadlineAt).toBe(
      DEADLINE_AT
    )
  })

  test("a newly observed deadline overwrites the stored one", () => {
    // Organisers do edit the refund policy limit date after announcement.
    const previous = status({
      announced: true,
      refundDeadlineAt: DEADLINE_AT,
    })
    const observation = withRefundDeadline(
      observeCompetition({
        wcaCompetitionId: "SpringOpen2026",
        mine: myCompetition(),
        index: competitionIndex(),
        fetchedAt: NOW,
      }),
      sampleCompetitionInfo({ refund_policy_limit_date: "2026-06-01" })
    )

    expect(mergeObservation(previous, observation).refundDeadlineAt).toBe(
      Date.UTC(2026, 5, 1) + DAY_MS
    )
  })

  test("carries forward a row written before the deadline was tracked", () => {
    const legacy = status({ announced: true })
    delete (legacy as { refundDeadlineAt?: number | null }).refundDeadlineAt

    const observation = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: myCompetition(),
      index: competitionIndex(),
      fetchedAt: NOW,
    })

    expect(mergeObservation(legacy, observation).refundDeadlineAt).toBeNull()
  })

  test("is null rather than undefined with nothing stored", () => {
    const observation = observeCompetition({
      wcaCompetitionId: "SpringOpen2026",
      mine: myCompetition(),
      index: competitionIndex(),
      fetchedAt: NOW,
    })

    const merged = mergeObservation(null, observation)
    expect(merged.refundDeadlineAt).toBeNull()
    expect("refundDeadlineAt" in merged).toBe(true)
  })
})

describe("withRefundDeadline", () => {
  test("folds the detail's deadline onto an observation", () => {
    const observation = inWindowObservation()

    expect(
      withRefundDeadline(
        observation,
        sampleCompetitionInfo({ refund_policy_limit_date: "2026-05-25" })
      ).refundDeadlineAt
    ).toBe(Date.UTC(2026, 4, 25) + DAY_MS)
  })

  test("leaves every other observed fact alone", () => {
    const observation = inWindowObservation({ resultsPosted: true })
    const { refundDeadlineAt: _ignored, ...rest } = observation

    expect(
      withRefundDeadline(observation, sampleCompetitionInfo())
    ).toMatchObject(rest)
  })

  test("a blank limit date clears back to unknown", () => {
    // The merge then carries the stored deadline forward rather than erasing it.
    const observation = inWindowObservation({
      refundDeadlineAt: Date.UTC(2026, 4, 25),
    })

    expect(
      withRefundDeadline(
        observation,
        sampleCompetitionInfo({ refund_policy_limit_date: "" })
      ).refundDeadlineAt
    ).toBeNull()
  })
})
