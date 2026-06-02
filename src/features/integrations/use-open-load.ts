import { useEffect, useState } from "react"
import { formatCatchError } from "@/features/integrations/error-message"

export function useOpenLoad<T>({
  open,
  load,
  onError,
}: {
  open: boolean
  load: () => Promise<T>
  onError: (message: string) => void
}) {
  const [data, setData] = useState<T | undefined>(undefined)

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    async function fetchData() {
      try {
        const result = await load()
        if (!cancelled) {
          setData(result)
        }
      } catch (caught) {
        if (!cancelled) {
          onError(formatCatchError(caught))
        }
      }
    }
    void fetchData()
    return () => {
      cancelled = true
    }
  }, [load, onError, open])

  return {
    data,
    setData,
    reset: () => {
      setData(undefined)
    },
  }
}
