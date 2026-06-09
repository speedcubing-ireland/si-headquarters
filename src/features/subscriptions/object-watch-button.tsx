import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { BellIcon } from "lucide-react"

type WatchableObject = Doc<"subscriptions">["object"]

export function ObjectWatchButton({ object }: { object: WatchableObject }) {
  const isWatching = useQuery(api.subscriptions.index.getSubscription, {
    object,
  })
  const setSubscription = useMutation(api.subscriptions.index.setSubscription)
  const isSubscribed = isWatching === true

  return (
    <Button
      size="lg"
      variant={isSubscribed ? "ghost" : "outline"}
      onClick={() => {
        void setSubscription({
          object,
          subscribe: !isSubscribed,
        })
      }}
    >
      <BellIcon />
      {isSubscribed ? "Subscribed" : "Watch"}
    </Button>
  )
}
