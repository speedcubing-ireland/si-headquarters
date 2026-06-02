import {
  MAIN_CONTAINER_MD_WIDTH,
  MainContainerContext,
  type MainContainerProviderProps,
} from "@/components/layout/main-container"
import {
  useCallback,
  useLayoutEffect,
  useState,
} from "react"

export function MainContainerProvider({ children }: MainContainerProviderProps) {
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

  const value = {
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
