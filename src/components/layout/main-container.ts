import { createContext, use, type ReactNode } from "react"

/** Matches Tailwind viewport md (768px) — main column below this uses compact layouts. */
export const MAIN_CONTAINER_MD_WIDTH = 768

export interface MainContainerContextValue {
  width: number
  isCompact: boolean
}

export const MainContainerContext =
  createContext<MainContainerContextValue | null>(null)

export function useMainContainer() {
  const context = use(MainContainerContext)
  if (!context) {
    throw new Error(
      "useMainContainer must be used within MainContainerProvider"
    )
  }
  return context
}

export interface MainContainerProviderProps {
  children: ReactNode
}
