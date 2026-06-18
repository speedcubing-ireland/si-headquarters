import { CheckIcon } from "lucide-react"
import type * as React from "react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { builtInThemes } from "@/lib/theme-constants"

type ThemeToggleOption = (typeof builtInThemes)[number]

interface ThemeToggleProps {
  trigger?: (theme: ThemeToggleOption) => React.ReactNode
  contentAlign?: React.ComponentProps<typeof DropdownMenuContent>["align"]
  contentClassName?: string
  contentSide?: React.ComponentProps<typeof DropdownMenuContent>["side"]
  contentSideOffset?: React.ComponentProps<
    typeof DropdownMenuContent
  >["sideOffset"]
}

function getThemeOption(theme: string): ThemeToggleOption {
  return (
    builtInThemes.find((themeOption) => themeOption.value === theme) ??
    builtInThemes[0]
  )
}

export function ThemeToggle({
  trigger,
  contentAlign = "end",
  contentClassName,
  contentSide,
  contentSideOffset,
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const currentTheme = getThemeOption(theme)
  const CurrentThemeIcon = currentTheme.icon
  const toggleTrigger = trigger?.(currentTheme) ?? (
    <Button variant="outline" size="icon">
      <CurrentThemeIcon className="size-4" />
      <span className="sr-only">Theme: {currentTheme.label}</span>
    </Button>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{toggleTrigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={contentAlign}
        className={contentClassName}
        side={contentSide}
        sideOffset={contentSideOffset}
      >
        {builtInThemes.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => {
              setTheme(value)
            }}
          >
            <Icon className="mr-2 size-4" />
            <span>{label}</span>
            {theme === value ? <CheckIcon className="ml-auto size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
