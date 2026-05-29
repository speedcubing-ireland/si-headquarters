import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useState, type ReactNode } from "react"
import { Link, type LinkProps } from "@tanstack/react-router"
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
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

export type BreadcrumbItem = {
  key: string
  label: string
} & LinkProps

function CrumbLink({ item: { label, ...props }}: { item: BreadcrumbItem }) {
  return (
    <BreadcrumbItem className="min-w-0">
      <BreadcrumbLink asChild className="max-w-36 truncate sm:max-w-56">
        <Link {...props}>{label}</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
  )
}

function CrumbPage({ label }: { label: string }) {
  return (
    <BreadcrumbItem className="min-w-0">
      <BreadcrumbPage className="max-w-40 truncate sm:max-w-72">
        {label}
      </BreadcrumbPage>
    </BreadcrumbItem>
  )
}

function CrumbSep() {
  return <BreadcrumbSeparator className="shrink-0" />
}

function CrumbEllipsis({ items }: { items: BreadcrumbItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <BreadcrumbItem>
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
    </BreadcrumbItem>
  )
}

export function NavRoot({
  children,
  flush = false,
  className,
}: {
  children: ReactNode
  /** When true, omits bottom margin so a filter bar can sit flush below. */
  flush?: boolean
  className?: string
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-12 shrink-0 items-center border-b bg-background",
        !flush && "mb-4",
        className
      )}
    >
      <div className="flex h-12 w-full min-w-0 items-center gap-2 px-3 sm:px-4 lg:px-6">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator
          orientation="vertical"
          className="hidden data-[orientation=vertical]:h-4 sm:block"
        />
        {children}
      </div>
    </header>
  )
}

export function NavBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
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

export function NavActions({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
  )
}
