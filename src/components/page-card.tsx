import type { ReactNode } from "react"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type CompetitionCardProps = {
  title: string
  icon: ReactNode
  children: ReactNode
}

export function PageCard({
  title,
  icon,
  children,
}: CompetitionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      {children}
    </Card>
  )
}

export function PageCardContent({
  className,
  ...props
}: React.ComponentProps<typeof CardContent>) {
  return (
    <CardContent className={cn("flex flex-col gap-4", className)} {...props} />
  )
}

export function PageCardFooter({
  className,
  ...props
}: React.ComponentProps<typeof CardFooter>) {
  return <CardFooter className={className} {...props} />
}

export function PageCardRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex justify-between">
      <Label>
        {icon}
        {label}
      </Label>
      {children}
    </div>
  )
}
