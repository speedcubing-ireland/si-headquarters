import type { FunctionReturnType } from "convex/server"
import { useAction } from "convex/react"
import { useCallback, useState } from "react"
import { api } from "@/convex/_generated/api"
import { useAsyncLoad } from "@/features/integrations"

export type Wca2faCodeState = FunctionReturnType<
  typeof api.plugins.wca.twoFactor.generateCode
>

export function useWca2faCode() {
  const generateCode = useAction(api.plugins.wca.twoFactor.generateCode)
  const [serverOffsetMs, setServerOffsetMs] = useState(0)

  const load = useCallback(async () => generateCode({}), [generateCode])
  const syncServerClock = useCallback((next: Wca2faCodeState) => {
    setServerOffsetMs(next.serverNowMs - Date.now())
  }, [])
  const { data, error, isFetching, hasLoaded, refresh } = useAsyncLoad(load, {
    clearDataOnError: false,
    onSuccess: syncServerClock,
  })

  return {
    codeState: data,
    error,
    isFetching,
    hasLoaded,
    serverOffsetMs,
    refreshCode: refresh,
  }
}
