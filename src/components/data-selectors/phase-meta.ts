import type { Doc } from "@/convex/_generated/dataModel"

export const PHASE_COLOR_CLASSES = {
  gray: "bg-gray-500 dark:bg-gray-400",
  slate: "bg-slate-500 dark:bg-slate-400",
  red: "bg-red-500 dark:bg-red-400",
  orange: "bg-orange-500 dark:bg-orange-400",
  amber: "bg-amber-500 dark:bg-amber-400",
  yellow: "bg-yellow-500 dark:bg-yellow-300",
  lime: "bg-lime-600 dark:bg-lime-400",
  green: "bg-green-600 dark:bg-green-400",
  emerald: "bg-emerald-600 dark:bg-emerald-400",
  teal: "bg-teal-600 dark:bg-teal-400",
  cyan: "bg-cyan-600 dark:bg-cyan-400",
  sky: "bg-sky-600 dark:bg-sky-400",
  blue: "bg-blue-600 dark:bg-blue-400",
  indigo: "bg-indigo-600 dark:bg-indigo-400",
  violet: "bg-violet-600 dark:bg-violet-400",
  purple: "bg-purple-600 dark:bg-purple-400",
  fuchsia: "bg-fuchsia-600 dark:bg-fuchsia-400",
  pink: "bg-pink-600 dark:bg-pink-400",
  rose: "bg-rose-600 dark:bg-rose-400",
} satisfies Record<Doc<"phases">["color"], string>
