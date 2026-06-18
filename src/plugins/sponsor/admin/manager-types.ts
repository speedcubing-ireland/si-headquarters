import type { FunctionReturnType } from "convex/server"
import type { api } from "@/convex/_generated/api"

export type ManagerCompetition = FunctionReturnType<
  typeof api.plugins.sponsor.admin.auctions.management.listCompetitionsForManager
>[number]

export type ManagerAuction = FunctionReturnType<
  typeof api.plugins.sponsor.admin.auctions.management.listForManager
>[number]

export type ManagerSponsor = FunctionReturnType<
  typeof api.plugins.sponsor.admin.sponsors.list
>[number]

export type ManagerView = NonNullable<
  FunctionReturnType<
    typeof api.plugins.sponsor.admin.auctions.management.getManagerView
  >
>
