import type { Doc } from "@/convex/_generated/dataModel";

export const PHASE_COLOR_CLASSES = {
  gray: "bg-gray-400 dark:bg-gray-600",
  red: "bg-red-500",
  sky: "bg-sky-500",
  amber: "bg-amber-400",
  green: "bg-green-600",
} satisfies Record<Doc<"phases">["color"], string>