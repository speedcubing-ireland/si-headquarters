import type { RegistrationDataV2 } from "@/convex/plugins/wca/openapiClient/types.gen"
import {
  firstNameFromFullName,
  hasPaid,
  isAcceptedRegistration,
  normalizeWcaId,
} from "@/convex/plugins/wca/registrationsLib"

interface RegistrationNote {
  firstName: string
  comment: string
  adminComment: string
}

export interface RefundVolunteer {
  id: string
  name: string
  wcaId?: string
  transferToWcaIds?: string[]
}

export interface RefundVolunteerMatch {
  volunteerId: string
  name: string
  wcaId?: string
  transferToWcaIds: string[]
  matchedWcaIds: string[]
  status: "already_refunded" | "refund_due"
  acceptedCount: number
  paidAcceptedCount: number
  unpaidAcceptedCount: number
  paidFirstNames: string[]
  paidComments: string[]
  paidAdminComments: string[]
  unpaidFirstNames: string[]
  unpaidComments: string[]
  unpaidAdminComments: string[]
  dueRegistrationId: number | null
  dueRegistrationFirstName: string | null
}

export type RefundDecisionStatus =
  | "already_refunded"
  | "refund_due"
  | "no_eligible_volunteer"

export interface RefundDecision {
  status: RefundDecisionStatus
  alreadyRefundedVolunteerIds: string[]
  dueVolunteerIds: string[]
  volunteerMatches: RefundVolunteerMatch[]
}

type NameCommentMap = Map<string, { comment: string; adminComment: string }>

function toNameCommentArrays(source: NameCommentMap): {
  firstNames: string[]
  comments: string[]
  adminComments: string[]
} {
  const firstNames = Array.from(source.keys()).sort()
  const comments = firstNames.map(
    (firstName) => source.get(firstName)?.comment ?? ""
  )
  const adminComments = firstNames.map(
    (firstName) => source.get(firstName)?.adminComment ?? ""
  )
  return { firstNames, comments, adminComments }
}

function getCandidateVolunteerWcaIds(volunteer: RefundVolunteer): string[] {
  const wcaIdCandidates: string[] = []
  if (volunteer.wcaId !== undefined && volunteer.wcaId !== "") {
    const normalized = normalizeWcaId(volunteer.wcaId)
    if (normalized !== "") {
      wcaIdCandidates.push(normalized)
    }
  }
  for (const entry of volunteer.transferToWcaIds ?? []) {
    const normalized = normalizeWcaId(entry)
    if (normalized !== "") {
      wcaIdCandidates.push(normalized)
    }
  }
  return [...new Set(wcaIdCandidates)]
}

export function buildRefundDecision(args: {
  registrations: RegistrationDataV2[]
  volunteers: RefundVolunteer[]
}): RefundDecision {
  const acceptedRegistrations = args.registrations.filter(
    isAcceptedRegistration
  )
  if (acceptedRegistrations.length === 0 || args.volunteers.length === 0) {
    return {
      status: "no_eligible_volunteer",
      alreadyRefundedVolunteerIds: [],
      dueVolunteerIds: [],
      volunteerMatches: [],
    }
  }

  const statsByVolunteerWcaId = new Map<
    string,
    {
      acceptedCount: number
      paidAcceptedCount: number
      unpaidAcceptedCount: number
    }
  >()
  const paidInfoByWcaId = new Map<string, Map<string, RegistrationNote>>()
  const unpaidInfoByWcaId = new Map<string, Map<string, RegistrationNote>>()
  const minPaidRegistrationByWcaId = new Map<
    string,
    { id: number; firstName: string }
  >()

  for (const registration of acceptedRegistrations) {
    const wcaId = normalizeWcaId(registration.user.wca_id)
    if (wcaId === "") continue

    const paid = hasPaid(registration)

    const current = statsByVolunteerWcaId.get(wcaId) ?? {
      acceptedCount: 0,
      paidAcceptedCount: 0,
      unpaidAcceptedCount: 0,
    }
    current.acceptedCount += 1
    if (paid) {
      current.paidAcceptedCount += 1
    } else {
      current.unpaidAcceptedCount += 1
    }
    statsByVolunteerWcaId.set(wcaId, current)

    const firstName = firstNameFromFullName(registration.user.name)

    if (paid) {
      const existing = minPaidRegistrationByWcaId.get(wcaId)
      if (existing === undefined || registration.id < existing.id) {
        minPaidRegistrationByWcaId.set(wcaId, {
          id: registration.id,
          firstName,
        })
      }
    }

    if (firstName === "") continue

    const comment = (
      typeof registration.competing.comment === "string"
        ? registration.competing.comment
        : ""
    ).trim()
    const adminComment = (
      typeof registration.competing.admin_comment === "string"
        ? registration.competing.admin_comment
        : ""
    ).trim()

    const infoByWcaId = paid ? paidInfoByWcaId : unpaidInfoByWcaId
    const byFirstName =
      infoByWcaId.get(wcaId) ?? new Map<string, RegistrationNote>()
    if (!byFirstName.has(firstName)) {
      byFirstName.set(firstName, { firstName, comment, adminComment })
      infoByWcaId.set(wcaId, byFirstName)
    }
  }

  const orderedVolunteers = [...args.volunteers].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const volunteerMatches: RefundVolunteerMatch[] = []
  const alreadyRefundedVolunteerIds: string[] = []
  const dueVolunteerIds: string[] = []

  for (const volunteer of orderedVolunteers) {
    const uniqueCandidateWcaIds = getCandidateVolunteerWcaIds(volunteer)
    if (uniqueCandidateWcaIds.length === 0) continue

    let acceptedCount = 0
    let paidAcceptedCount = 0
    let unpaidAcceptedCount = 0
    const matchedWcaIds: string[] = []
    const paidByFirstName: NameCommentMap = new Map()
    const unpaidByFirstName: NameCommentMap = new Map()

    for (const wcaId of uniqueCandidateWcaIds) {
      const stats = statsByVolunteerWcaId.get(wcaId)
      if (!stats) continue
      matchedWcaIds.push(wcaId)
      acceptedCount += stats.acceptedCount
      paidAcceptedCount += stats.paidAcceptedCount
      unpaidAcceptedCount += stats.unpaidAcceptedCount

      const paidInfo = paidInfoByWcaId.get(wcaId)
      if (paidInfo) {
        for (const entry of paidInfo.values()) {
          if (!paidByFirstName.has(entry.firstName)) {
            paidByFirstName.set(entry.firstName, {
              comment: entry.comment,
              adminComment: entry.adminComment,
            })
          }
        }
      }
      const unpaidInfo = unpaidInfoByWcaId.get(wcaId)
      if (unpaidInfo) {
        for (const entry of unpaidInfo.values()) {
          if (!unpaidByFirstName.has(entry.firstName)) {
            unpaidByFirstName.set(entry.firstName, {
              comment: entry.comment,
              adminComment: entry.adminComment,
            })
          }
        }
      }
    }

    if (matchedWcaIds.length === 0) continue

    const {
      firstNames: paidFirstNames,
      comments: paidComments,
      adminComments: paidAdminComments,
    } = toNameCommentArrays(paidByFirstName)
    const {
      firstNames: unpaidFirstNames,
      comments: unpaidComments,
      adminComments: unpaidAdminComments,
    } = toNameCommentArrays(unpaidByFirstName)

    let dueRegistrationId: number | null = null
    let dueRegistrationFirstName: string | null = null
    if (paidAcceptedCount > 0 && unpaidAcceptedCount === 0) {
      for (const wcaId of uniqueCandidateWcaIds) {
        const entry = minPaidRegistrationByWcaId.get(wcaId)
        if (entry === undefined) continue
        if (dueRegistrationId === null || entry.id < dueRegistrationId) {
          dueRegistrationId = entry.id
          dueRegistrationFirstName = entry.firstName
        }
      }
    }

    volunteerMatches.push({
      volunteerId: volunteer.id,
      name: volunteer.name,
      wcaId: volunteer.wcaId,
      transferToWcaIds: (volunteer.transferToWcaIds ?? []).map((entry) =>
        normalizeWcaId(entry)
      ),
      matchedWcaIds,
      status: unpaidAcceptedCount > 0 ? "already_refunded" : "refund_due",
      acceptedCount,
      paidAcceptedCount,
      unpaidAcceptedCount,
      paidFirstNames,
      paidComments,
      paidAdminComments,
      unpaidFirstNames,
      unpaidComments,
      unpaidAdminComments,
      dueRegistrationId,
      dueRegistrationFirstName,
    })

    if (unpaidAcceptedCount > 0) {
      alreadyRefundedVolunteerIds.push(volunteer.id)
    } else if (paidAcceptedCount > 0) {
      dueVolunteerIds.push(volunteer.id)
    }
  }

  if (dueVolunteerIds.length > 0) {
    return {
      status: "refund_due",
      alreadyRefundedVolunteerIds,
      dueVolunteerIds,
      volunteerMatches,
    }
  }

  if (alreadyRefundedVolunteerIds.length > 0) {
    return {
      status: "already_refunded",
      alreadyRefundedVolunteerIds,
      dueVolunteerIds: [],
      volunteerMatches,
    }
  }

  return {
    status: "no_eligible_volunteer",
    alreadyRefundedVolunteerIds: [],
    dueVolunteerIds: [],
    volunteerMatches,
  }
}
