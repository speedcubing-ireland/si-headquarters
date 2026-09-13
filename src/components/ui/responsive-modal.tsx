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
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  createContext,
  use,
  type ComponentProps,
  type FormHTMLAttributes,
  type ReactNode,
} from "react"

interface ResponsiveModalContextValue {
  isMobile: boolean
}

const ResponsiveModalContext =
  createContext<ResponsiveModalContextValue | null>(null)

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
  const isMobile = useIsMobile()

  return (
    <ResponsiveModalContext value={{ isMobile }}>
      {isMobile ? (
        <Drawer {...props}>{children}</Drawer>
      ) : (
        <Dialog {...props}>{children}</Dialog>
      )}
    </ResponsiveModalContext>
  )
}

function Trigger(props: ComponentProps<typeof DialogTrigger>) {
  const { isMobile } = useResponsiveModal()
  return isMobile ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />
}

function Close(props: ComponentProps<typeof DialogClose>) {
  const { isMobile } = useResponsiveModal()
  return isMobile ? <DrawerClose {...props} /> : <DialogClose {...props} />
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

  if (isMobile) {
    return (
      <DrawerContent
        className={cn(
          "max-h-[calc(100dvh-0.5rem)] min-h-0 overflow-hidden",
          className,
          mobileClassName
        )}
      >
        {children}
      </DrawerContent>
    )
  }

  return (
    <DialogContent
      className={cn(
        "flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-0 overflow-hidden p-0",
        className,
        desktopClassName
      )}
    >
      {children}
    </DialogContent>
  )
}

function Form({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      className={cn("flex min-h-0 min-w-0 flex-col", className)}
      {...props}
    />
  )
}

function Header({ className, ...props }: ComponentProps<"div">) {
  const { isMobile } = useResponsiveModal()

  if (isMobile) {
    return (
      <DrawerHeader
        className={cn("shrink-0 gap-2 px-4 pt-2 pb-4 text-left", className)}
        {...props}
      />
    )
  }

  return (
    <DialogHeader
      className={cn("shrink-0 px-4 pt-4 pr-12 pb-4", className)}
      {...props}
    />
  )
}

function Title(props: ComponentProps<typeof DialogTitle>) {
  const { isMobile } = useResponsiveModal()
  return isMobile ? <DrawerTitle {...props} /> : <DialogTitle {...props} />
}

function Description(props: ComponentProps<typeof DialogDescription>) {
  const { isMobile } = useResponsiveModal()
  return isMobile ? (
    <DrawerDescription {...props} />
  ) : (
    <DialogDescription {...props} />
  )
}

function Body({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4",
        className
      )}
      {...props}
    />
  )
}

function Footer({ className, ...props }: ComponentProps<"div">) {
  const { isMobile } = useResponsiveModal()

  if (isMobile) {
    return (
      <DrawerFooter
        className={cn(
          "mt-0 shrink-0 flex-col-reverse border-t bg-muted/50 p-4",
          className
        )}
        {...props}
      />
    )
  }

  return (
    <DialogFooter
      className={cn("mx-0 mb-0 shrink-0", className)}
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
