import { useCallback, useEffect, useState } from "react"
import { formatCatchError } from "@/features/integrations/error-message"

interface AsyncLoadOptions<T> {
  clearDataOnError?: boolean
  onSuccess?: (value: T) => void
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
  { clearDataOnError = true, onSuccess }: AsyncLoadOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)

  const refresh = useCallback(async () => {
    setIsFetching(true)
    setError(null)
    try {
      const result = await load()
      setData(result)
      onSuccess?.(result)
    } catch (caught) {
      if (clearDataOnError) {
        setData(null)
      }
      setError(formatCatchError(caught))
    } finally {
      setIsFetching(false)
      setHasLoaded(true)
    }
  }, [clearDataOnError, load, onSuccess])

  useEffect(() => {
    let cancelled = false
    async function loadInitial() {
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
          setData(null)
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
  }, [clearDataOnError, load, onSuccess])

  return {
    data,
    error,
    isFetching,
    hasLoaded,
    refresh,
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
