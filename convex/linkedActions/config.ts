import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type {
	canvaTemplateActionConfig,
	linkedActionRunPermission,
	linkedActionType,
	linkedSheetActionConfig,
} from "../lib/validators";

const SHORT_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const CANVA_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const DEFAULT_RUN_PERMISSION_BY_TYPE: Record<
	Doc<"linkedActionDefinitions">["type"],
	Infer<typeof linkedActionRunPermission>
> = {
	canva_template: "volunteer",
	linked_sheet: "anyone",
};

export function assertShortId(shortId: string) {
	if (!SHORT_ID_PATTERN.test(shortId)) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message:
				"Short ID must use lowercase letters/numbers and optional '.' or '-' separators.",
		});
	}
}

export function isCanvaConfig(
	config: Doc<"linkedActionDefinitions">["config"],
): config is Infer<typeof canvaTemplateActionConfig> {
	return "sourceBrandTemplateId" in config;
}

export function isLinkedSheetConfig(
	config: Doc<"linkedActionDefinitions">["config"],
): config is Infer<typeof linkedSheetActionConfig> {
	return "operation" in config;
}

export function assertConfigMatchesType(
	type: Doc<"linkedActionDefinitions">["type"],
	config: Doc<"linkedActionDefinitions">["config"],
) {
	if (type === "canva_template" && isCanvaConfig(config)) return;
	if (type === "linked_sheet" && isLinkedSheetConfig(config)) return;
	throw new ConvexError({
		code: "BAD_REQUEST",
		message: `Config does not match action type "${type}".`,
	});
}

function assertCanonicalCanvaId(args: {
	field: "sourceBrandTemplateId" | "destinationFolderId";
	value: string;
	allowRoot: boolean;
}) {
	const trimmed = args.value.trim();
	if (!trimmed) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `${args.field} is required.`,
		});
	}
	if (args.allowRoot && trimmed === "root") return;
	if (args.allowRoot && trimmed === "shared") {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `${args.field} value "shared" is not supported by Canva API. Use "root" or a real folder ID.`,
		});
	}
	if (trimmed.includes("://")) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `${args.field} must be a Canva ID, not a URL.`,
		});
	}
	if (!CANVA_ID_PATTERN.test(trimmed)) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: `${args.field} must be a canonical Canva ID.`,
		});
	}
}

export function canonicalizeCanvaConfig(
	config: Infer<typeof canvaTemplateActionConfig>,
): Infer<typeof canvaTemplateActionConfig> {
	const sourceBrandTemplateId = config.sourceBrandTemplateId.trim();
	const destinationFolderId = config.destinationFolderId.trim();
	assertCanonicalCanvaId({
		field: "sourceBrandTemplateId",
		value: sourceBrandTemplateId,
		allowRoot: false,
	});
	assertCanonicalCanvaId({
		field: "destinationFolderId",
		value: destinationFolderId,
		allowRoot: true,
	});
	return {
		...config,
		sourceBrandTemplateId,
		destinationFolderId,
	};
}

export function canonicalizeConfigForType(
	type: Doc<"linkedActionDefinitions">["type"],
	config: Doc<"linkedActionDefinitions">["config"],
): Doc<"linkedActionDefinitions">["config"] {
	if (type === "canva_template" && isCanvaConfig(config)) {
		return canonicalizeCanvaConfig(config);
	}
	return config;
}

export function normalizeRunPermissionForType(
	type: Infer<typeof linkedActionType>,
	runPermission: Infer<typeof linkedActionRunPermission>,
): Infer<typeof linkedActionRunPermission> {
	if (type === "canva_template" && runPermission === "anyone") {
		return "volunteer";
	}
	return runPermission;
}
