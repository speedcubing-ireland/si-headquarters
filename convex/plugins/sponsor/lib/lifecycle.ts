import type { Doc } from "@/convex/_generated/dataModel"

type StartTargetInput = Pick<
  Doc<"sponsorshipAuctions">,
  "state" | "startsAt"
> & {
  now: number
}

export function resolveAuctionStartTargetState(
  input: StartTargetInput
): "active" | "scheduled" | "noop" {
  if (input.state === "active") {
    return "noop"
  }
  if (input.state === "scheduled" && input.startsAt > input.now) {
    return "noop"
  }
  return input.startsAt > input.now ? "scheduled" : "active"
}
