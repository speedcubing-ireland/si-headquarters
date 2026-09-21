import { gettingStartedVideoUrl } from "@/config/lib/organisation"

/**
 * The walkthrough recording, when the organisation has one configured. Renders
 * nothing when it does not, so a fork without a video gets the written guide
 * rather than an empty frame.
 */
export function GettingStartedVideo() {
  const src = gettingStartedVideoUrl()

  if (src === null) {
    return null
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-muted/30">
      <div className="aspect-video">
        <iframe
          className="size-full"
          src={src}
          title="Walkthrough: competitions, tasks, and subtasks"
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  )
}
