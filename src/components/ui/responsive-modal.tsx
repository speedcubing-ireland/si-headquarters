"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  createContext,
  use,
  type ComponentProps,
  type FormHTMLAttributes,
  type ReactNode,
} from "react"
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

interface ResponsiveModalContextValue {
  isDesktop: boolean
}

const ResponsiveModalContext =
  createContext<ResponsiveModalContextValue | null>(null)

function useResponsiveModalContext() {
  const context = use(ResponsiveModalContext)
  if (context === null) {
    throw new Error(
      "ResponsiveModal components must be used within ResponsiveModal"
    )
  }
  return context
}

interface ResponsiveModalRootProps {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function ResponsiveModal({ children, ...props }: ResponsiveModalRootProps) {
  const isDesktop = !useIsMobile()
  const Root = isDesktop ? Dialog : Drawer

  return (
    <ResponsiveModalContext value={{ isDesktop }}>
      <Root {...props} {...(!isDesktop && { autoFocus: true })}>
        {children}
      </Root>
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
  const { isDesktop } = useResponsiveModalContext()
  const Trigger = isDesktop ? DialogTrigger : DrawerTrigger

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
  const { isDesktop } = useResponsiveModalContext()
  const Close = isDesktop ? DialogClose : DrawerClose

  return (
    <Close className={className} {...props}>
      {children}
    </Close>
  )
}

const responsiveModalContentClassName =
  "flex max-h-[min(92dvh,calc(100svh-2rem))] min-w-0 flex-col gap-0 overflow-hidden p-0"

function ResponsiveModalContent({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<"div">) {
  const { isDesktop } = useResponsiveModalContext()
  const Content = isDesktop ? DialogContent : DrawerContent

  return (
    <Content
      className={cn(responsiveModalContentClassName, className)}
      {...props}
    >
      {children}
    </Content>
  )
}

const responsiveModalFrameClassName =
  "flex min-h-0 min-w-0 flex-1 flex-col"

function ResponsiveModalFrame({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<"div">) {
  return (
    <div className={cn(responsiveModalFrameClassName, className)} {...props}>
      {children}
    </div>
  )
}

function ResponsiveModalForm({
  className,
  children,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className={cn(responsiveModalFrameClassName, className)} {...props}>
      {children}
    </form>
  )
}

function ResponsiveModalHeader({
  className,
  children,
  ...props
}: ResponsiveModalChildProps & ComponentProps<"div">) {
  const { isDesktop } = useResponsiveModalContext()
  const Header = isDesktop ? DialogHeader : DrawerHeader

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
  const { isDesktop } = useResponsiveModalContext()
  const Title = isDesktop ? DialogTitle : DrawerTitle

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
  const { isDesktop } = useResponsiveModalContext()
  const Description = isDesktop ? DialogDescription : DrawerDescription

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
        "min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-4",
        className
      )}
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
  const { isDesktop } = useResponsiveModalContext()
  const Footer = isDesktop ? DialogFooter : DrawerFooter

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
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
}
