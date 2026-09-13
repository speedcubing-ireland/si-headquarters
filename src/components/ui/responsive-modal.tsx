"use client"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ComboboxPortalContainerProvider } from "@/components/ui/combobox"
import { PopoverPortalContainerProvider } from "@/components/ui/popover"
import {
  getVisualViewportBox,
  isKeyboardVisible,
  subscribeToVisualViewportChanges,
} from "@/components/ui/visual-viewport"
import { cn } from "@/lib/utils"
import {
  createContext,
  use,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
  type FormHTMLAttributes,
  type ReactNode,
} from "react"

interface ResponsiveModalContextValue {
  isMobile: boolean
}

const ResponsiveModalContext =
  createContext<ResponsiveModalContextValue | null>(null)

const MOBILE_MODAL_MEDIA_QUERY =
  "(max-width: 767px), ((pointer: coarse) and (max-height: 767px))"

function subscribeToMobileModalQuery(onChange: () => void) {
  const mediaQuery = window.matchMedia(MOBILE_MODAL_MEDIA_QUERY)
  mediaQuery.addEventListener("change", onChange)
  return () => {
    mediaQuery.removeEventListener("change", onChange)
  }
}

function getMobileModalSnapshot() {
  return window.matchMedia(MOBILE_MODAL_MEDIA_QUERY).matches
}

function useIsMobileModal() {
  return useSyncExternalStore(
    subscribeToMobileModalQuery,
    getMobileModalSnapshot,
    () => false
  )
}

function useResponsiveModal() {
  const context = use(ResponsiveModalContext)
  if (context === null) {
    throw new Error("ResponsiveModal components require ResponsiveModal.Root")
  }
  return context
}

function Root({
  children,
  ...props
}: {
  children: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobileModal()

  return (
    <ResponsiveModalContext value={{ isMobile }}>
      <Dialog {...props}>{children}</Dialog>
    </ResponsiveModalContext>
  )
}

function Trigger(props: ComponentProps<typeof DialogTrigger>) {
  return <DialogTrigger {...props} />
}

function Close(props: ComponentProps<typeof DialogClose>) {
  return <DialogClose {...props} />
}

const visualViewportStyle = {
  "--responsive-modal-viewport-height": "100dvh",
  "--responsive-modal-viewport-left": "0px",
  "--responsive-modal-viewport-top": "0px",
  "--responsive-modal-viewport-width": "100dvw",
} as CSSProperties

function useMobileVisualViewport(
  contentRef: React.RefObject<HTMLDivElement | null>,
  isMobile: boolean
) {
  useLayoutEffect(() => {
    const content = contentRef.current
    if (!isMobile || content === null) return

    const syncViewport = () => {
      const viewportBox = getVisualViewportBox(window.visualViewport, {
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
      })

      content.style.setProperty(
        "--responsive-modal-viewport-height",
        `${String(viewportBox.height)}px`
      )
      content.style.setProperty(
        "--responsive-modal-viewport-left",
        `${String(viewportBox.left)}px`
      )
      content.style.setProperty(
        "--responsive-modal-viewport-top",
        `${String(viewportBox.top)}px`
      )
      content.style.setProperty(
        "--responsive-modal-viewport-width",
        `${String(viewportBox.width)}px`
      )
      content.dataset.keyboardOpen = String(
        isKeyboardVisible(viewportBox, window.innerHeight)
      )
    }

    syncViewport()
    const unsubscribe = subscribeToVisualViewportChanges({
      cancelFrame: (frameId) => {
        window.cancelAnimationFrame(frameId)
      },
      onChange: syncViewport,
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      visualViewport: window.visualViewport,
      windowTarget: window,
    })

    return () => {
      unsubscribe()
      content.style.removeProperty("--responsive-modal-viewport-height")
      content.style.removeProperty("--responsive-modal-viewport-left")
      content.style.removeProperty("--responsive-modal-viewport-top")
      content.style.removeProperty("--responsive-modal-viewport-width")
      delete content.dataset.keyboardOpen
    }
  }, [contentRef, isMobile])
}

function Content({
  children,
  className,
  desktopClassName,
  mobileClassName,
}: {
  children: ReactNode
  className?: string
  desktopClassName?: string
  mobileClassName?: string
}) {
  const { isMobile } = useResponsiveModal()
  const contentRef = useRef<HTMLDivElement>(null)
  const [portalContainer, setPortalContainer] =
    useState<HTMLDivElement | null>(null)
  useMobileVisualViewport(contentRef, isMobile)

  return (
    <DialogContent
      ref={contentRef}
      style={visualViewportStyle}
      tabIndex={-1}
      onOpenAutoFocus={(event) => {
        if (!isMobile) return

        event.preventDefault()
        contentRef.current?.focus({ preventScroll: true })
      }}
      className={cn(
        "group/responsive-modal flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-0 overflow-hidden p-0",
        isMobile &&
          "top-(--responsive-modal-viewport-top) left-(--responsive-modal-viewport-left) h-(--responsive-modal-viewport-height) max-h-none w-(--responsive-modal-viewport-width) max-w-none translate-x-0 translate-y-0 rounded-none ring-0 duration-0 data-open:zoom-in-100 data-closed:zoom-out-100",
        className,
        isMobile ? mobileClassName : desktopClassName
      )}
    >
      <div ref={setPortalContainer} className="contents" />
      <ComboboxPortalContainerProvider
        container={portalContainer ?? undefined}
      >
        <PopoverPortalContainerProvider
          container={portalContainer ?? undefined}
        >
          {children}
        </PopoverPortalContainerProvider>
      </ComboboxPortalContainerProvider>
    </DialogContent>
  )
}

function Form({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function Header({ className, ...props }: ComponentProps<"div">) {
  const { isMobile } = useResponsiveModal()

  return (
    <DialogHeader
      className={cn(
        "shrink-0 border-b px-4 pt-4 pr-12 pb-4",
        isMobile &&
          "gap-1 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3",
        className
      )}
      {...props}
    />
  )
}

function Title(props: ComponentProps<typeof DialogTitle>) {
  return <DialogTitle {...props} />
}

function Description({
  className,
  ...props
}: ComponentProps<typeof DialogDescription>) {
  const { isMobile } = useResponsiveModal()

  return (
    <DialogDescription
      className={cn(isMobile && "sr-only", className)}
      {...props}
    />
  )
}

function Body({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 min-w-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]",
        className
      )}
      {...props}
    />
  )
}

function Footer({ className, ...props }: ComponentProps<"div">) {
  return (
    <DialogFooter
      className={cn(
        "mx-0 mb-0 grid shrink-0 grid-cols-2 border-t bg-muted/50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] group-data-[keyboard-open=true]/responsive-modal:pb-3 sm:flex sm:p-4",
        className
      )}
      {...props}
    />
  )
}

export const ResponsiveModal = {
  Root,
  Trigger,
  Close,
  Content,
  Form,
  Header,
  Title,
  Description,
  Body,
  Footer,
}
