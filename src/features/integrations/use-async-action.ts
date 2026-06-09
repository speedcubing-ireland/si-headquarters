import { unknownErrorMessage } from "@/convex/integrations/errorPayload"
import { useCallback, useEffect, useState } from "react"

interface AsyncLoadOptions<T> {
  clearDataOnError?: boolean
  enabled?: boolean
  onSuccess?: (value: T) => void
}

function formatCatchError(
  // oxlint-disable-next-line typescript/no-restricted-types -- catch bindings are validated at the boundary
  caught: unknown
): string {
  return unknownErrorMessage(caught, { includeConvexError: true })
}

export function useAsyncAction() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function run(action: () => Promise<void>): Promise<boolean> {
    setPending(true)
    setError(null)
    try {
      await action()
      return true
    } catch (caught) {
      setError(formatCatchError(caught))
      return false
    } finally {
      setPending(false)
    }
  }

  return { error, setError, pending, run }
}

export function useTaggedAsyncAction<Tag extends string>() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Tag | null>(null)

  async function run(tag: Tag, action: () => Promise<void>) {
    setPending(tag)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(formatCatchError(caught))
    } finally {
      setPending(null)
    }
  }

  return { error, pending, run }
}

export function useAsyncLoad<T>(
  load: () => Promise<T>,
  {
    clearDataOnError = true,
    enabled = true,
    onSuccess,
  }: AsyncLoadOptions<T> = {}
) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(enabled)
  const [hasLoaded, setHasLoaded] = useState(false)

  const reset = useCallback(() => {
    setData(undefined)
  }, [])

  const refresh = useCallback(async () => {
    setIsFetching(true)
    setError(null)
    try {
      const result = await load()
      setData(result)
      onSuccess?.(result)
    } catch (caught) {
      if (clearDataOnError) {
        setData(undefined)
      }
      setError(formatCatchError(caught))
    } finally {
      setIsFetching(false)
      setHasLoaded(true)
    }
  }, [clearDataOnError, load, onSuccess])

  useEffect(() => {
    if (!enabled) {
      setIsFetching(false)
      return
    }

    let cancelled = false
    async function loadInitial() {
      setIsFetching(true)
      setError(null)
      try {
        const result = await load()
        if (cancelled) {
          return
        }
        setData(result)
        onSuccess?.(result)
      } catch (caught) {
        if (cancelled) {
          return
        }
        if (clearDataOnError) {
          setData(undefined)
        }
        setError(formatCatchError(caught))
      } finally {
        if (!cancelled) {
          setIsFetching(false)
          setHasLoaded(true)
        }
      }
    }
    void loadInitial()
    return () => {
      cancelled = true
    }
  }, [clearDataOnError, enabled, load, onSuccess])

  return {
    data,
    error,
    isFetching,
    hasLoaded,
    refresh,
    reset,
    setData,
  }
}

export function useOpenLoad<T>({
  open,
  load,
  onError,
}: {
  open: boolean
  load: () => Promise<T>
  onError: (message: string) => void
}) {
  const { data, reset, setData, error } = useAsyncLoad(load, {
    enabled: open,
    clearDataOnError: false,
  })

  useEffect(() => {
    if (error !== null) {
      onError(error)
    }
  }, [error, onError])

  return {
    data,
    setData,
    reset,
  }
}

/** Open/close state for link pickers and popovers. */
export function useLinkAction() {
  const [open, setOpen] = useState(false)
  const asyncAction = useAsyncAction()

  function close() {
    setOpen(false)
    asyncAction.setError(null)
  }

  return {
    open,
    setOpen,
    close,
    ...asyncAction,
  }
}
