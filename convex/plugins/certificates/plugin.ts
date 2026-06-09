import type { BackendProjectWorkflowPlugin } from "@/convex/projectWorkflows/types"
import { certificateProjectWorkflowDefinitions } from "@/convex/plugins/certificates/workflows"

export const certificatesPlugin: BackendProjectWorkflowPlugin = {
  id: "certificates",
  projectWorkflowDefinitions: certificateProjectWorkflowDefinitions,
}
