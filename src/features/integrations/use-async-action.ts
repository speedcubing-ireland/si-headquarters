import { useState } from "react"
import { formatCatchError } from "@/features/integrations/error-message"

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
