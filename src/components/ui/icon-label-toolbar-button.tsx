import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { ComponentProps } from "react"

type IconLabelToolbarButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "size"
> & {
  icon: LucideIcon
  label: string
}

export function IconLabelToolbarButton({
  className,
  icon: Icon,
  label,
  type = "button",
  variant = "outline",
  ...props
}: IconLabelToolbarButtonProps) {
  return (
    <Button
      aria-label={label}
      className={cn("shrink-0", className)}
      size="lg"
      title={label}
      type={type}
      variant={variant}
      {...props}
    >
      <Icon aria-hidden="true" />
      <span className="hidden @sm/main:inline">{label}</span>
    </Button>
  )
}
