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
import { OverlayPortalContainerProvider } from "@/components/ui/overlay-portal-container"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  useState,
  type ComponentProps,
  type FocusEvent,
  type FormHTMLAttributes,
  type ReactNode,
} from "react"

/** Bounded height for scrollable DnD lists inside modal bodies. */
export const responsiveModalScrollAreaClassName =
  "max-h-[min(62svh,34rem)] pr-3"

const desktopModalContentClassName =
  "relative flex max-h-[min(92dvh,calc(100svh-2rem))] min-w-0 flex-col gap-0 overflow-hidden p-0"

const mobileModalContentClassName =
  "relative flex h-full min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden p-0"

const responsiveModalLayoutClassName =
  "flex min-h-0 min-w-0 flex-1 flex-col"

function scrollFocusedFieldIntoView(event: FocusEvent<HTMLDivElement>) {
  const { target } = event
  if (!(target instanceof HTMLElement)) {
    return
  }

  const field = target.closest(
    "input, textarea, select, [contenteditable='true']"
  )
  if (field === null) {
    return
  }

  requestAnimationFrame(() => {
    field.scrollIntoView({ block: "nearest" })
  })
}

type ResponsiveModalRootProps = ComponentProps<typeof Dialog>

function ResponsiveModal({ children, ...props }: ResponsiveModalRootProps) {
  return <Dialog {...props}>{children}</Dialog>
}

type ResponsiveModalChildProps = {
  children?: ReactNode
  className?: string
  asChild?: boolean
}

function ResponsiveModalTrigger({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<typeof DialogTrigger>) {
  return (
    <DialogTrigger className={className} {...props}>
      {children}
    </DialogTrigger>
  )
}

function ResponsiveModalClose({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<typeof DialogClose>) {
  return (
    <DialogClose className={className} {...props}>
      {children}
    </DialogClose>
  )
}

function ResponsiveModalOverlayPortals({
  children,
}: {
  children: ReactNode
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  )

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={setPortalContainer}
        className="pointer-events-none absolute inset-0 z-[60]"
      />
      <OverlayPortalContainerProvider container={portalContainer ?? undefined}>
        {children}
      </OverlayPortalContainerProvider>
    </div>
  )
}

type ResponsiveModalContentProps = ComponentProps<typeof DialogContent>

function ResponsiveModalContent({
  className,
  children,
  showCloseButton,
  presentation,
  ...props
}: ResponsiveModalContentProps) {
  const isMobile = useIsMobile()

  return (
    <DialogContent
      className={cn(
        isMobile ? mobileModalContentClassName : desktopModalContentClassName,
        className
      )}
      showCloseButton={showCloseButton}
      presentation={presentation ?? (isMobile ? "fullscreen" : "default")}
      {...props}
    >
      <ResponsiveModalOverlayPortals>{children}</ResponsiveModalOverlayPortals>
    </DialogContent>
  )
}

/** Scroll-safe layout for non-form content (e.g. drag-and-drop lists). */
function ResponsiveModalFrame({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<"div">) {
  return (
    <div className={cn(responsiveModalLayoutClassName, className)} {...props}>
      {children}
    </div>
  )
}

/** Scroll-safe layout for forms; use with `onSubmit` and submit actions. */
function ResponsiveModalForm({
  className,
  children,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className={cn(responsiveModalLayoutClassName, className)} {...props}>
      {children}
    </form>
  )
}

function ResponsiveModalHeader({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<"div">) {
  return (
    <DialogHeader className={cn("shrink-0 px-4 pt-4 pr-10", className)} {...props}>
      {children}
    </DialogHeader>
  )
}

function ResponsiveModalTitle({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<typeof DialogTitle>) {
  return (
    <DialogTitle className={className} {...props}>
      {children}
    </DialogTitle>
  )
}

function ResponsiveModalDescription({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<typeof DialogDescription>) {
  return (
    <DialogDescription className={className} {...props}>
      {children}
    </DialogDescription>
  )
}

function ResponsiveModalBody({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4",
        className
      )}
      onFocusCapture={scrollFocusedFieldIntoView}
      {...props}
    >
      {children}
    </div>
  )
}

function ResponsiveModalFooter({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<"div">) {
  return (
    <DialogFooter
      className={cn("mx-0 mb-0 shrink-0 border-t bg-muted/50", className)}
      {...props}
    >
      {children}
    </DialogFooter>
  )
}

export {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalForm,
  ResponsiveModalFrame,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
}
