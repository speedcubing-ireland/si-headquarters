"use node"

import { ConvexError } from "convex/values"
import { internal } from "@/convex/_generated/api"
import { action } from "@/convex/_generated/server"
import { resolveWcaBaseUrl } from "@/convex/deploymentContext"
import { buildRefundDecision } from "@/convex/refunds/logic"
import {
  refundComputationResultShape,
  type CompetitionRefundSummary,
  type RefundComputationResult,
  type RefundVolunteerRecord,
  type RefundVolunteerMatch,
} from "@/convex/refunds/api"
import { createWcaClient } from "@/convex/plugins/wca/client"
import {
  getMyCompetitions,
  getRegistrationsAdmin,
} from "@/convex/plugins/wca/openapiClient/sdk.gen"
import {
  isAcceptedRegistration,
  parseDateOnlyToUtcMs,
} from "@/convex/plugins/wca/registrationsLib"

const RECENT_PAST_DAYS_WINDOW = 21

function formatDateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getRecentPastWindow() {
  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)
  const periodStartUtc = new Date(todayUtc.getTime())
  periodStartUtc.setUTCDate(
    periodStartUtc.getUTCDate() - RECENT_PAST_DAYS_WINDOW
  )
  return {
    periodStartUtc,
    periodEndUtcExclusive: todayUtc,
  }
}

export const computeRefunds = action({
  args: {},
  returns: refundComputationResultShape,
  handler: async (ctx): Promise<RefundComputationResult> => {
    await ctx.runQuery(internal.access.authorize.assertRefundsAccess, {})

    const volunteerDocs: RefundVolunteerRecord[] = await ctx.runQuery(
      internal.refunds.api.listVolunteersInternal,
      {}
    )
    const activeVolunteerDocs: RefundVolunteerRecord[] = volunteerDocs.filter(
      (doc) => !doc.archived
    )
    const volunteerById = new Map(
      activeVolunteerDocs.map((doc) => [String(doc.id), doc])
    )

    const { periodStartUtc, periodEndUtcExclusive } = getRecentPastWindow()
    const periodStartMs = periodStartUtc.getTime()
    const periodEndMs = periodEndUtcExclusive.getTime()

    const wcaToken: string = await ctx.runAction(
      internal.integrations.tokens.getValidServiceToken,
      { service: "wca" }
    )
    const wcaClient = createWcaClient(wcaToken)
    const myCompetitionsResponse = await getMyCompetitions({
      client: wcaClient,
    })
    if (myCompetitionsResponse.data === undefined) {
      throw new ConvexError({
        code: "BAD_GATEWAY",
        message: "Failed to fetch competitions from WCA.",
      })
    }

    const recentPastCompetitions =
      myCompetitionsResponse.data.past_competitions.filter((competition) => {
        const endMs = parseDateOnlyToUtcMs(competition.end_date)
        if (endMs === null) return false
        return endMs >= periodStartMs && endMs < periodEndMs
      })
    const upcomingCompetitions = myCompetitionsResponse.data.future_competitions
    const candidates = [...recentPastCompetitions, ...upcomingCompetitions]
    const uniqueById = new Map<string, (typeof candidates)[number]>()
    for (const competition of candidates) {
      uniqueById.set(competition.id, competition)
    }

    const selectedCompetitions: (typeof candidates)[number][] = Array.from(
      uniqueById.values()
    ).sort((left, right) => left.start_date.localeCompare(right.start_date))

    const competitionSummaries = await Promise.all(
      selectedCompetitions.map(async (competition) => {
        const competitionId = competition.id
        const registrationResponse = await getRegistrationsAdmin({
          client: wcaClient,
          path: { competitionId },
        })

        if (registrationResponse.error !== undefined) {
          const noMatches: RefundVolunteerMatch[] = []
          const errorSummary: CompetitionRefundSummary = {
            competitionId,
            competitionName: competition.name,
            startDate: competition.start_date,
            endDate: competition.end_date,
            wcaUrl: `${resolveWcaBaseUrl()}/competitions/${encodeURIComponent(competitionId)}`,
            status: "no_eligible_volunteer",
            registrationCount: 0,
            acceptedRegistrationCount: 0,
            volunteerMatches: noMatches,
            error: "Failed to fetch registrations from WCA.",
          }
          return errorSummary
        }

        const registrations = Array.isArray(registrationResponse.data)
          ? registrationResponse.data
          : []
        const acceptedRegistrationCount = registrations.filter(
          isAcceptedRegistration
        ).length
        const competitionStartMs = parseDateOnlyToUtcMs(competition.start_date)
        const isFutureCompetition =
          competitionStartMs !== null && competitionStartMs >= periodEndMs
        if (isFutureCompetition && acceptedRegistrationCount === 0) {
          return null
        }

        const decision = buildRefundDecision({
          registrations,
          volunteers: activeVolunteerDocs.map((volunteer) => ({
            id: String(volunteer.id),
            name: volunteer.name,
            wcaId: volunteer.wcaId,
            transferToWcaIds: volunteer.transferToWcaIds,
          })),
        })

        const volunteerMatches: RefundVolunteerMatch[] =
          decision.volunteerMatches
            .map((match) => {
              const volunteer = volunteerById.get(match.volunteerId)
              if (volunteer === undefined) return null
              const matchResult: RefundVolunteerMatch = {
                volunteerId: volunteer.id,
                name: match.name,
                wcaId: match.wcaId,
                transferToWcaIds: match.transferToWcaIds,
                matchedWcaIds: match.matchedWcaIds,
                status: match.status,
                acceptedCount: match.acceptedCount,
                paidAcceptedCount: match.paidAcceptedCount,
                unpaidAcceptedCount: match.unpaidAcceptedCount,
                paidComments: match.paidComments,
                paidAdminComments: match.paidAdminComments,
                unpaidComments: match.unpaidComments,
                unpaidAdminComments: match.unpaidAdminComments,
                paidFirstNames: match.paidFirstNames,
                unpaidFirstNames: match.unpaidFirstNames,
                dueRegistrationId: match.dueRegistrationId,
                dueRegistrationFirstName: match.dueRegistrationFirstName,
                dueRegistrationEditUrl:
                  match.dueRegistrationId !== null
                    ? `${resolveWcaBaseUrl()}/registrations/${String(match.dueRegistrationId)}/edit`
                    : null,
              }
              return matchResult
            })
            .filter((entry): entry is RefundVolunteerMatch => entry !== null)

        const noError: string | null = null
        const summary: CompetitionRefundSummary = {
          competitionId,
          competitionName: competition.name,
          startDate: competition.start_date,
          endDate: competition.end_date,
          wcaUrl: `${resolveWcaBaseUrl()}/competitions/${encodeURIComponent(competitionId)}`,
          status: decision.status,
          registrationCount: registrations.length,
          acceptedRegistrationCount,
          volunteerMatches,
          error: noError,
        }
        return summary
      })
    )

    const competitions = competitionSummaries.filter(
      (entry): entry is CompetitionRefundSummary => entry !== null
    )

    return {
      periodStartDate: formatDateOnlyUtc(periodStartUtc),
      periodEndDate: formatDateOnlyUtc(periodEndUtcExclusive),
      competitions,
    }
  },
})
