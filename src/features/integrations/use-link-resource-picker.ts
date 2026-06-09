import { useMemo, useState } from "react"
import { useOpenLoad } from "@/features/integrations/use-async-action"

export function useLinkResourcePicker<TItem, TModel>({
  open,
  load,
  onError,
  buildModel,
}: {
  open: boolean
  load: () => Promise<TItem[]>
  onError: (message: string | null) => void
  buildModel: (items: TItem[] | undefined, query: string) => TModel
}) {
  const [query, setQuery] = useState("")

  const { data, reset } = useOpenLoad({
    open,
    load,
    onError: (message) => {
      onError(message)
    },
  })

  const model = useMemo(
    () => buildModel(data, query),
    [buildModel, data, query]
  )

  function resetPicker() {
    setQuery("")
    reset()
    onError(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetPicker()
    }
  }

  return {
    query,
    setQuery,
    data,
    model,
    loading: data === undefined,
    resetPicker,
    handleOpenChange,
  }
}
