import type { Infer } from "convex/values";
import type {
	approvalShape,
	linkedResource,
	userShape as sharedUserShape,
	teamShape,
	labelShape,
	phaseShape,
	taskStatus,
	taskPriority,
	linkedActionType,
	linkedActionRunPermission,
	linkedActionConfig,
	linkedTaskActionStatus,
	canvaTemplateActionConfig,
	linkedSheetActionConfig,
} from "./validators";

export { TASK_STATUSES, TASK_PRIORITIES } from "./validators";

export type TaskStatus = Infer<typeof taskStatus>;
export type TaskPriority = Infer<typeof taskPriority>;

export type UserShape = Infer<typeof sharedUserShape>;
export type TeamShape = Infer<typeof teamShape>;
export type ApprovalShape = Infer<typeof approvalShape>;
export type LinkedResource = Infer<typeof linkedResource>;
export type LabelUI = Infer<typeof labelShape>;
export type PhaseUI = Infer<typeof phaseShape>;
export type LinkedActionType = Infer<typeof linkedActionType>;
export type LinkedActionRunPermission = Infer<typeof linkedActionRunPermission>;
export type LinkedActionConfig = Infer<typeof linkedActionConfig>;
export type CanvaTemplateActionConfig = Infer<typeof canvaTemplateActionConfig>;
export type LinkedSheetActionConfig = Infer<typeof linkedSheetActionConfig>;
export type LinkedTaskActionStatus = Infer<typeof linkedTaskActionStatus>;

export type { ActivityMetadata } from "./validators";
