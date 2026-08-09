import { useAction } from "convex/react"
import { ImageOffIcon, RefreshCwIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/convex/_generated/api"
import type { TaskIntegrationCardRow } from "@/features/integrations/task-integration-card-shell"

const THUMBNAIL_RETRY_AFTER_MS = 60 * 1000

type ThumbnailState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; url: string; refreshAt: number }

export function CanvaThumbnail({
  integrationId,
}: {
  integrationId: TaskIntegrationCardRow["_id"]
}) {
  const loadThumbnail = useAction(api.plugins.canva.links.refreshThumbnail)
  const [thumbnail, setThumbnail] = useState<ThumbnailState>({
    status: "loading",
  })

  const refresh = useCallback(async () => {
    const result = await loadThumbnail({ id: integrationId }).catch(() => null)
    if (result?.success === true) {
      setThumbnail({
        status: "ready",
        url: result.thumbnailUrl,
        refreshAt: Date.now() + result.refreshAfterMs,
      })
      return
    }

    setThumbnail((current) =>
      current.status === "ready"
        ? { ...current, refreshAt: Date.now() + THUMBNAIL_RETRY_AFTER_MS }
        : { status: "error" }
    )
  }, [integrationId, loadThumbnail])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const refreshAt = thumbnail.status === "ready" ? thumbnail.refreshAt : null
  useEffect(() => {
    if (refreshAt === null) return
    const timer = window.setTimeout(
      () => {
        void refresh()
      },
      Math.max(0, refreshAt - Date.now())
    )
    return () => {
      window.clearTimeout(timer)
    }
  }, [refresh, refreshAt])

  if (thumbnail.status !== "ready") {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/20 text-muted-foreground">
        {thumbnail.status === "loading" ? (
          <Spinner />
        ) : (
          <ImageOffIcon className="size-6" />
        )}
        <span className="text-sm">
          {thumbnail.status === "loading"
            ? "Loading preview…"
            : "Preview unavailable"}
        </span>
        {thumbnail.status === "error" ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setThumbnail({ status: "loading" })
              void refresh()
            }}
          >
            <RefreshCwIcon />
            Retry
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex justify-center rounded-lg border">
      <img
        className="h-48 w-auto object-contain"
        src={thumbnail.url}
        alt="Canva design preview"
        onError={() => {
          setThumbnail({ status: "error" })
        }}
      />
    </div>
  )
}
