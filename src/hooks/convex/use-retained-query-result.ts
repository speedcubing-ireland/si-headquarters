import { useState } from "react"

export type RetainedQueryResult<T> =
  | {
      data: undefined
      isLoading: true
      isRefreshing: false
    }
  | {
      data: T
      isLoading: false
      isRefreshing: boolean
    }

export function useRetainedQueryResult<T>(
  result: T | undefined,
  key = "__default__"
): RetainedQueryResult<T> {
  const [retained, setRetained] = useState<{
    key: string
    value: T | undefined
  }>({ key, value: undefined })

  if (!Object.is(retained.key, key)) {
    setRetained({ key, value: undefined })
  } else if (result !== undefined && result !== retained.value) {
    setRetained({ key, value: result })
  }

  const data = result ?? retained.value
  if (data === undefined) {
    return {
      data: undefined,
      isLoading: true,
      isRefreshing: false,
    }
  }

  return {
    data,
    isLoading: false,
    isRefreshing: result === undefined,
  }
}
