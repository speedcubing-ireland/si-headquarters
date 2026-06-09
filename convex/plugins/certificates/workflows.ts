import { internal } from "@/convex/_generated/api"
import { TASK_LABEL_CODES } from "@/convex/tasks/labels/constants"
import type {
  ProjectWorkflowDefinition,
  ProjectWorkflowRunResult,
} from "@/convex/projectWorkflows/types"

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00.000Z`)
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10)
}

interface CertificateOrderingScanResult {
  totalCertificateTasks: number
  openCertificateTasks: { name: string; dueDate: string | null }[]
  needsAttention: { name: string; dueDate: string | null }[]
}

export const certificateProjectWorkflowDefinitions: readonly ProjectWorkflowDefinition[] =
  [
    {
      id: "certificates.ordering",
      pluginId: "certificates",
      label: "Certificate ordering",
      description:
        "Find certificate-labelled project tasks that need ordering attention before their due dates.",
      defaultConfig: {
        kind: "certificates.ordering",
        leadTimeDays: 18,
      },
      schedule: { kind: "daily" },
      run: async (ctx, run): Promise<ProjectWorkflowRunResult> => {
        const config = run.installation.config
        const threshold = addDays(isoToday(), config.leadTimeDays)
        const result: CertificateOrderingScanResult = await ctx.runQuery(
          internal.plugins.certificates.queries.scanOrderingTasks,
          {
            projectId: run.project._id,
            thresholdDate: threshold,
            labelCode: TASK_LABEL_CODES.certificates,
          }
        )

        if (result.totalCertificateTasks === 0) {
          return {
            status: "noop",
            summary:
              "No certificate-labelled tasks were found for this project.",
          }
        }

        if (result.openCertificateTasks.length === 0) {
          return {
            status: "completed",
            summary: "All certificate-labelled tasks are complete.",
          }
        }

        if (result.needsAttention.length === 0) {
          return {
            status: "noop",
            summary: `${String(result.openCertificateTasks.length)} certificate task(s) are open, but none are due by ${threshold}.`,
          }
        }

        const preview = result.needsAttention
          .slice(0, 5)
          .map(
            (task) =>
              `${task.name}${task.dueDate === null ? "" : ` (${task.dueDate})`}`
          )
          .join(", ")
        return {
          status: "attention",
          summary: `Certificate ordering attention needed for ${String(result.needsAttention.length)} task(s): ${preview}.`,
        }
      },
    },
  ]
