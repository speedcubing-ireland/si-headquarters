/* eslint-disable react-refresh/only-export-components -- compound Page API */
// Inside HQ Layout, use @sm/main etc. container queries; keep viewport sm:/md: for portaled UI.
import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Loader2, ShieldX } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Link, type LinkProps } from "@tanstack/react-router"
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem as BreadcrumbItemPrimitive,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const PAGE_HORIZONTAL_PADDING = "px-3 @sm/main:px-4 @lg/main:px-6"

export const PAGE_CONTENT_PADDING = "p-4 @lg/main:p-6"

export const PAGE_CONTENT_PADDING_SCROLL = cn(PAGE_CONTENT_PADDING, "pb-10")

export type PageBreadcrumbItem = {
  key: string
  label: string
} & LinkProps

export type PageStatusVariant = "loading" | "denied" | "empty"

function CrumbLink({ item: { label, ...props } }: { item: PageBreadcrumbItem }) {
  return (
    <BreadcrumbItemPrimitive className="min-w-0">
      <BreadcrumbLink asChild className="max-w-36 truncate @sm/main:max-w-56">
        <Link {...props}>{label}</Link>
      </BreadcrumbLink>
    </BreadcrumbItemPrimitive>
  )
}

function CrumbPage({ label }: { label: string }) {
  return (
    <BreadcrumbItemPrimitive className="min-w-0">
      <BreadcrumbPage className="max-w-40 truncate @sm/main:max-w-72">
        {label}
      </BreadcrumbPage>
    </BreadcrumbItemPrimitive>
  )
}

function CrumbSep() {
  return <BreadcrumbSeparator className="shrink-0" />
}

function CrumbEllipsis({ items }: { items: PageBreadcrumbItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <BreadcrumbItemPrimitive>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost">
            <BreadcrumbEllipsis />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            {items.map(({ key, label, ...props }) => (
              <DropdownMenuItem key={key} asChild>
                <Link {...props}>{label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItemPrimitive>
  )
}

function PageRoot({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">{children}</div>
  )
}

function PageShell({
  title,
  header,
  children,
  contentClassName,
}: {
  title?: string
  header?: ReactNode
  children: ReactNode
  contentClassName?: string
}) {
  return (
    <PageRoot>
      <PageHeader>{header ?? <PageTitle>{title}</PageTitle>}</PageHeader>
      <PageContent className={contentClassName}>{children}</PageContent>
    </PageRoot>
  )
}

function PageHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-12 shrink-0 items-center border-b bg-background",
        className
      )}
    >
      <div
        className={cn(
          "flex h-12 w-full min-w-0 items-center gap-2",
          PAGE_HORIZONTAL_PADDING
        )}
      >
        <SidebarTrigger className="-ml-1 shrink-0" />
        {children}
      </div>
    </header>
  )
}

function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="truncate font-heading text-base font-semibold leading-none">
      {children}
    </h1>
  )
}

function PageActions({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
  )
}

function PageToolbar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "shrink-0 border-b bg-background",
        PAGE_HORIZONTAL_PADDING,
        className
      )}
    >
      {children}
    </div>
  )
}

function PageContent({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
        className
      )}
    >
      {children}
    </div>
  )
}

function PageStatus({
  variant,
  message,
}: {
  variant: PageStatusVariant
  message: string
}) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      {variant === "loading" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : null}
      {variant === "denied" ? (
        <ShieldX className="size-8 text-muted-foreground" />
      ) : null}
      <p>{message}</p>
    </div>
  )
}

function PageEntityState<T>({
  value,
  loadingMessage,
  emptyMessage,
  children,
}: {
  value: T | null | undefined
  loadingMessage: string
  emptyMessage: string
  children: (data: T) => ReactNode
}) {
  if (value === null) {
    return <PageStatus variant="empty" message={emptyMessage} />
  }
  if (value === undefined) {
    return <PageStatus variant="loading" message={loadingMessage} />
  }
  return children(value)
}

function PageBreadcrumbs({ items }: { items: PageBreadcrumbItem[] }) {
  if (items.length === 0) return null

  const first = items[0]
  const last = items[items.length - 1]
  const secondToLast = items.length > 2 ? items[items.length - 2] : null
  const middle = items.slice(1, -2)

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap">
        {items.length === 1 ? (
          <CrumbPage label={last.label} />
        ) : (
          <>
            <CrumbLink item={first} />
            {middle.length > 0 && (
              <>
                <CrumbSep />
                <CrumbEllipsis items={middle} />
              </>
            )}
            {secondToLast && (
              <>
                <CrumbSep />
                <CrumbLink item={secondToLast} />
              </>
            )}
            <CrumbSep />
            <CrumbPage label={last.label} />
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export const Page = {
  Root: PageRoot,
  Shell: PageShell,
  Header: PageHeader,
  Title: PageTitle,
  Actions: PageActions,
  Toolbar: PageToolbar,
  Content: PageContent,
  Status: PageStatus,
  EntityState: PageEntityState,
  Breadcrumbs: PageBreadcrumbs,
}
