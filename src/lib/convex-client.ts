import { ConvexReactClient } from "convex/react"
import { env } from "@/env"

// Module scope so route loaders can reach the deployment before React (and the
// sign-in wall in __root) has rendered anything.
export const convex = new ConvexReactClient(env.VITE_CONVEX_URL)
