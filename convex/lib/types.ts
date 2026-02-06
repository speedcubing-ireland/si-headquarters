/**
 * Shared type utilities for Convex validators.
 *
 * Domain types (Task, Competition, …) are derived on the frontend via
 * FunctionReturnType<typeof api.module.query> — see src/data/types-new.ts.
 *
 * This file only re-exports enum/union types and small shared shapes that are
 * useful across multiple Convex files or the frontend.
 */

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

export type { ActivityMetadata } from "./validators";
