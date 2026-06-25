"use client"

import { ComboboxPortalContainerProvider } from "@/components/ui/combobox"
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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { PopoverPortalContainerProvider } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  createContext,
  use,
  useState,
  type ComponentProps,
  type FocusEvent,
  type FormHTMLAttributes,
  type ReactNode,
} from "react"

type ResponsiveModalVariant = "form" | "sheet"
type ResponsiveModalShell = "dialog" | "drawer"

interface ResponsiveModalContextValue {
  shell: ResponsiveModalShell
  isMobileForm: boolean
}

const ResponsiveModalContext =
  createContext<ResponsiveModalContextValue | null>(null)

const SHELL_COMPONENTS = {
  dialog: {
    Trigger: DialogTrigger,
    Close: DialogClose,
    Header: DialogHeader,
    Title: DialogTitle,
    Description: DialogDescription,
    Footer: DialogFooter,
  },
  drawer: {
    Trigger: DrawerTrigger,
    Close: DrawerClose,
    Header: DrawerHeader,
    Title: DrawerTitle,
    Description: DrawerDescription,
    Footer: DrawerFooter,
  },
} as const

function resolveResponsiveModalShell(
  isDesktop: boolean,
  variant: ResponsiveModalVariant
): ResponsiveModalShell {
  if (isDesktop || variant === "form") {
    return "dialog"
  }
  return "drawer"
}

function useResponsiveModalContext() {
  const context = use(ResponsiveModalContext)
  if (context === null) {
    throw new Error(
      "ResponsiveModal components must be used within ResponsiveModal"
    )
  }
  return context
}

function useResponsiveModalShell() {
  const { shell } = useResponsiveModalContext()
  return SHELL_COMPONENTS[shell]
}

function scrollFocusedFieldIntoView(event: FocusEvent<HTMLDivElement>) {
  const { target } = event
  if (
    !(target instanceof HTMLInputElement) &&
    !(target instanceof HTMLTextAreaElement) &&
    !(target instanceof HTMLSelectElement) &&
    target.getAttribute("contenteditable") !== "true"
  ) {
    return
  }

  requestAnimationFrame(() => {
    target.scrollIntoView({ block: "nearest" })
  })
}

interface ResponsiveModalRootProps {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * `form` — fullscreen dialog on mobile (keyboard-friendly; iOS does not
   * support `interactive-widget`). `sheet` — bottom drawer on mobile for
   * lightweight content without heavy text input.
   */
  variant?: ResponsiveModalVariant
}

function ResponsiveModal({
  children,
  variant = "form",
  ...props
}: ResponsiveModalRootProps) {
  const isDesktop = !useIsMobile()
  const shell = resolveResponsiveModalShell(isDesktop, variant)
  const isMobileForm = !isDesktop && variant === "form"
  const contextValue: ResponsiveModalContextValue = { shell, isMobileForm }

  if (shell === "dialog") {
    return (
      <ResponsiveModalContext value={contextValue}>
        <Dialog {...props}>{children}</Dialog>
      </ResponsiveModalContext>
    )
  }

  return (
    <ResponsiveModalContext value={contextValue}>
      <Drawer {...props}>{children}</Drawer>
    </ResponsiveModalContext>
  )
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
  const { Trigger } = useResponsiveModalShell()

  return (
    <Trigger className={className} {...props}>
      {children}
    </Trigger>
  )
}

function ResponsiveModalClose({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<typeof DialogClose>) {
  const { Close } = useResponsiveModalShell()

  return (
    <Close className={className} {...props}>
      {children}
    </Close>
  )
}

const desktopModalContentClassName =
  "relative flex max-h-[min(92dvh,calc(100svh-2rem))] min-w-0 flex-col gap-0 overflow-hidden p-0"

const mobileFullscreenModalContentClassName =
  "relative flex min-h-0 min-w-0 flex-col gap-0 overflow-hidden p-0"

const mobileDrawerContentClassName =
  "relative flex min-h-0 min-w-0 flex-col gap-0 overflow-hidden p-0"

type ResponsiveModalContentProps = ComponentProps<typeof DialogContent> &
  Partial<ComponentProps<typeof DrawerContent>>

function ResponsiveModalContent({
  className,
  children,
  showCloseButton,
  presentation,
  ...props
}: ResponsiveModalContentProps) {
  const { shell, isMobileForm } = useResponsiveModalContext()

  if (shell === "dialog") {
    return (
      <DialogContent
        className={cn(
          isMobileForm
            ? mobileFullscreenModalContentClassName
            : desktopModalContentClassName,
          className
        )}
        showCloseButton={showCloseButton}
        presentation={presentation ?? (isMobileForm ? "fullscreen" : "default")}
        {...props}
      >
        {children}
      </DialogContent>
    )
  }

  return (
    <DrawerContent
      className={cn(mobileDrawerContentClassName, className)}
      {...props}
    >
      {children}
    </DrawerContent>
  )
}

const responsiveModalLayoutClassName =
  "flex min-h-0 min-w-0 flex-1 flex-col"

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

/**
 * Anchors combobox and popover portals inside the modal so overlays are not
 * clipped by the scrollable body.
 */
function ResponsiveModalPortalContainer({
  children,
}: {
  children: ReactNode
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  )

  return (
    <>
      <div
        ref={setPortalContainer}
        className="pointer-events-none absolute inset-0 z-60"
      />
      <ComboboxPortalContainerProvider
        container={portalContainer ?? undefined}
      >
        <PopoverPortalContainerProvider
          container={portalContainer ?? undefined}
        >
          {children}
        </PopoverPortalContainerProvider>
      </ComboboxPortalContainerProvider>
    </>
  )
}

function ResponsiveModalHeader({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<"div">) {
  const { Header } = useResponsiveModalShell()

  return (
    <Header className={cn("shrink-0 px-4 pt-4 pr-10", className)} {...props}>
      {children}
    </Header>
  )
}

function ResponsiveModalTitle({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<typeof DialogTitle>) {
  const { Title } = useResponsiveModalShell()

  return (
    <Title className={className} {...props}>
      {children}
    </Title>
  )
}

function ResponsiveModalDescription({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<typeof DialogDescription>) {
  const { Description } = useResponsiveModalShell()

  return (
    <Description className={className} {...props}>
      {children}
    </Description>
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
  const { Footer } = useResponsiveModalShell()

  return (
    <Footer
      className={cn("mx-0 mb-0 shrink-0 border-t bg-muted/50", className)}
      {...props}
    >
      {children}
    </Footer>
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
  ResponsiveModalPortalContainer,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
}
export type { ResponsiveModalVariant }
