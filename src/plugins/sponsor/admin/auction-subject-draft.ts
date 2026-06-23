import type { Id } from "@/convex/_generated/dataModel"

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
