import { Monitor, Moon, Sun } from "lucide-react"

export const builtInThemes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export type BuiltInTheme = (typeof builtInThemes)[number]["value"]
