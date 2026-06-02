import {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react"

/** Matches Tailwind viewport md (768px) — main column below this uses compact layouts. */
export const MAIN_CONTAINER_MD_WIDTH = 768

interface MainContainerContextValue {
  width: number
  isCompact: boolean
}

const MainContainerContext = createContext<MainContainerContextValue | null>(
  null
)

export function MainContainerProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  const ref = useCallback((nextNode: HTMLDivElement | null) => {
    setNode(nextNode)
  }, [])

  useLayoutEffect(() => {
    if (!node) {
      return
    }

    let cancelled = false
    const update = () => {
      if (cancelled) {
        return
      }
      const nextWidth = node.getBoundingClientRect().width
      setWidth((current) =>
        Math.abs(current - nextWidth) < 0.5 ? current : nextWidth
      )
    }

    update()
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(node)

    return () => {
      cancelled = true
      resizeObserver.disconnect()
    }
  }, [node])

  const value: MainContainerContextValue = {
    width,
    isCompact: width > 0 && width < MAIN_CONTAINER_MD_WIDTH,
  }

  return (
    <MainContainerContext value={value}>
      <div ref={ref} className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </MainContainerContext>
  )
}

export function useMainContainer() {
  const context = use(MainContainerContext)
  if (!context) {
    throw new Error("useMainContainer must be used within MainContainerProvider")
  }
  return context
}
