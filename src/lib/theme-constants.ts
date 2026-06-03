import { Monitor, Moon, Sun } from "lucide-react"

export const builtInThemes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export type BuiltInTheme = (typeof builtInThemes)[number]["value"]

export const STAT_CARD_EMPHASIS_CLASS = "border-primary/30"
