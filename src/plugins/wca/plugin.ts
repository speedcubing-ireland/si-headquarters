import type { Plugin } from "@/plugins/registry"
import { WcaCompetitionStatusRow } from "@/plugins/wca/competition-status-row"

/**
 * The WCA integration has no page of its own — it contributes the WCA status
 * row to the competition properties card.
 */
export const wcaPlugin: Plugin = {
  id: "wca",
  feature: "wcaIntegration",
  nav: [],
  competitionProperties: [WcaCompetitionStatusRow],
}
