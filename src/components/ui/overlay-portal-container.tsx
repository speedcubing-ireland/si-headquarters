"use client"

import {
  createContext,
  use,
  type ComponentType,
  type ReactNode,
} from "react"

const OverlayPortalContainerContext =
  createContext<HTMLElement | undefined>(undefined)

type OverlayPortalComponent = ComponentType<{
  children?: ReactNode
  container?: HTMLElement
}>

function OverlayPortalContainerProvider({
  children,
  container,
}: {
  children: ReactNode
  container: HTMLElement | undefined
}) {
  return (
    <OverlayPortalContainerContext value={container}>
      {children}
    </OverlayPortalContainerContext>
  )
}

function useOverlayPortalContainer() {
  return use(OverlayPortalContainerContext)
}

function OverlayPortal({
  Portal,
  children,
}: {
  Portal: OverlayPortalComponent
  children: ReactNode
}) {
  const portalContainer = useOverlayPortalContainer()

  if (portalContainer === undefined) {
    return <Portal>{children}</Portal>
  }

  return <Portal container={portalContainer}>{children}</Portal>
}

export {
  OverlayPortal,
  OverlayPortalContainerProvider,
  useOverlayPortalContainer,
}
