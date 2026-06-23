import type { Id } from "@/convex/_generated/dataModel"
import { isFeatureEnabled } from "@/config/lib/organisation"

export type AuctionSubjectSource =
  | "hq_competition"
  | "wca_competition"
  | "custom"

export interface WcaCompetitionSelection {
  id: string
  name: string
  city: string
  countryIso2: string
  startDate: string
  endDate: string
}

export interface AuctionSubjectDraft {
  source: AuctionSubjectSource
  hqCompetitionId: Id<"competitions"> | null
  wca: WcaCompetitionSelection | null
  customName: string
  customDescriptionMarkdown: string
  customCompetitionId: Id<"competitions"> | null
}

export const emptyAuctionSubjectDraft: AuctionSubjectDraft = {
  source: "hq_competition",
  hqCompetitionId: null,
  wca: null,
  customName: "",
  customDescriptionMarkdown: "",
  customCompetitionId: null,
}

export function normalizeAuctionSubjectDraft(
  draft: AuctionSubjectDraft
): AuctionSubjectDraft {
  if (
    draft.source === "wca_competition" &&
    !isWcaAuctionSubjectSourceAvailable()
  ) {
    return { ...draft, source: "hq_competition", wca: null }
  }
  return draft
}

export function applyAuctionSubjectDraftPatch(
  draft: AuctionSubjectDraft,
  patch: Partial<AuctionSubjectDraft>
): AuctionSubjectDraft {
  return normalizeAuctionSubjectDraft({ ...draft, ...patch })
}

const AUCTION_SUBJECT_SOURCE_LABELS = {
  hq_competition: "HQ competition",
  wca_competition: "WCA competition",
  custom: "Custom offering",
} as const satisfies Record<AuctionSubjectSource, string>

export function isWcaAuctionSubjectSourceAvailable(): boolean {
  return isFeatureEnabled("wcaIntegration")
}

export function getAuctionSubjectSourceOptions(): {
  value: AuctionSubjectSource
  label: string
}[] {
  const sources: AuctionSubjectSource[] = ["hq_competition"]
  if (isWcaAuctionSubjectSourceAvailable()) {
    sources.push("wca_competition")
  }
  sources.push("custom")
  return sources.map((value) => ({
    value,
    label: AUCTION_SUBJECT_SOURCE_LABELS[value],
  }))
}

function isAuctionSubjectSource(value: string): value is AuctionSubjectSource {
  return (
    value === "hq_competition" ||
    value === "wca_competition" ||
    value === "custom"
  )
}

export function isAllowedAuctionSubjectSource(
  value: string
): value is AuctionSubjectSource {
  if (!isAuctionSubjectSource(value)) return false
  return value !== "wca_competition" || isWcaAuctionSubjectSourceAvailable()
}

export type AuctionSubjectInputArg =
  | { kind: "hq_competition"; competitionId: Id<"competitions"> }
  | { kind: "wca_competition"; wcaCompetitionId: string }
  | {
      kind: "custom"
      associatedCompetitionId?: Id<"competitions">
      name: string
      descriptionMarkdown: string
    }

export type BuildSubjectResult =
  | { ok: true; value: AuctionSubjectInputArg }
  | { ok: false; error: string }

export function buildAuctionSubjectInput(
  draft: AuctionSubjectDraft
): BuildSubjectResult {
  if (draft.source === "hq_competition") {
    if (draft.hqCompetitionId === null) {
      return { ok: false, error: "Select a competition first." }
    }
    return {
      ok: true,
      value: { kind: "hq_competition", competitionId: draft.hqCompetitionId },
    }
  }
  if (draft.source === "wca_competition") {
    if (!isWcaAuctionSubjectSourceAvailable()) {
      return {
        ok: false,
        error: "WCA competitions are not available for this organisation.",
      }
    }
    if (draft.wca === null) {
      return { ok: false, error: "Search for and select a WCA competition." }
    }
    return {
      ok: true,
      value: { kind: "wca_competition", wcaCompetitionId: draft.wca.id },
    }
  }
  const name = draft.customName.trim()
  if (name.length === 0) {
    return { ok: false, error: "Give the custom offering a name." }
  }
  return {
    ok: true,
    value: {
      kind: "custom",
      name,
      descriptionMarkdown: draft.customDescriptionMarkdown,
      ...(draft.customCompetitionId !== null
        ? { associatedCompetitionId: draft.customCompetitionId }
        : {}),
    },
  }
}
