import { parseLocalDate } from "@/convex/competitions/dates"

export type SponsorshipLifecycle = "upcoming" | "ongoing" | "completed"

export function resolveSponsorshipLifecycle(input: {
  startDate: string
  endDate: string
  now?: number
}): SponsorshipLifecycle {
  const now = input.now ?? Date.now()
  const start = parseLocalDate(input.startDate)
  const end = parseLocalDate(input.endDate)

  if (start === null || end === null) {
    return "upcoming"
  }

  const endOfDay = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
    23,
    59,
    59,
    999
  )

  if (now < start.getTime()) {
    return "upcoming"
  }
  if (now > endOfDay.getTime()) {
    return "completed"
  }
  return "ongoing"
}

const lifecycleSortRank: Record<SponsorshipLifecycle, number> = {
  ongoing: 0,
  upcoming: 1,
  completed: 2,
}

export function compareSponsorshipLifecycle(
  left: SponsorshipLifecycle,
  right: SponsorshipLifecycle
): number {
  return lifecycleSortRank[left] - lifecycleSortRank[right]
}
