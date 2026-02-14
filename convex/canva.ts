"use node";

import { ConvexError, v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { requireVolunteerAction } from "./lib/oauth";
import {
	createAutofillJob,
	createCanvaClient,
	getBrandTemplateDataset,
	getDesign,
	getFolder,
	getAutofillJob,
	listBrandTemplates as listBrandTemplatesApi,
	listFolderItems as listFolderItemsApi,
	moveFolderItem,
} from "./lib/canvaClient";
import {
	buildCanvaAutofillData,
	mapBrandTemplatePickerItems,
	parseCanvaDesignInput,
	parseCanvaFolderInput,
} from "./canva/helpers";
import {
	buildCanvaOAuthUrl,
	exchangeToken,
	getCanvaClientId,
	getValidAccessToken,
} from "./canva/oauth";

export {
	buildCanvaAutofillData,
	mapBrandTemplatePickerItems,
	parseCanvaDesignInput,
	parseCanvaFolderInput,
} from "./canva/helpers";

function extractConvexErrorCode(error: unknown): string | null {
	if (!(error instanceof ConvexError)) return null;
	const data = error.data;
	if (!data || typeof data !== "object" || !("code" in data)) {
		return null;
	}
	const code = (data as { code?: unknown }).code;
	return typeof code === "string" ? code : null;
}

function isTaskAccessError(error: unknown): boolean {
	const code = extractConvexErrorCode(error);
	return (
		code === "UNAUTHENTICATED" || code === "FORBIDDEN" || code === "NOT_FOUND"
	);
}

async function requireCanvaRunAccess(
	ctx: ActionCtx,
	args: {
		taskId?: Id<"tasks">;
		taskLinkedActionId?: Id<"taskLinkedActions">;
	},
) {
	if (args.taskId && args.taskLinkedActionId) {
		try {
			const taskActions = await ctx.runQuery(api.linkedActions.listForTask, {
				taskId: args.taskId,
			});
			const match = taskActions.find(
				(item) => item.id === args.taskLinkedActionId,
			);
			if (match && match.definition.type === "canva_template" && match.canRun) {
				return;
			}
		} catch (error) {
			if (!isTaskAccessError(error)) {
				console.error("Unexpected failure while validating Canva run access.", {
					taskId: args.taskId,
					taskLinkedActionId: args.taskLinkedActionId,
					error,
				});
				throw error;
			}
		}
	}
	await requireVolunteerAction(ctx);
}

async function requireCanvaPickerAccess(ctx: ActionCtx) {
	const isDirector = await ctx.runQuery(api.admin.isDirector, {});
	if (isDirector) return;
	await requireVolunteerAction(ctx);
}

async function requireCanvaDesignAccess(
	ctx: ActionCtx,
	args: {
		taskId?: Id<"tasks">;
		taskLinkedActionId?: Id<"taskLinkedActions">;
	},
) {
	if (args.taskId && args.taskLinkedActionId) {
		try {
			const taskActions = await ctx.runQuery(api.linkedActions.listForTask, {
				taskId: args.taskId,
			});
			const match = taskActions.find(
				(item) => item.id === args.taskLinkedActionId,
			);
			if (match && match.definition.type === "canva_template") {
				return;
			}
		} catch (error) {
			if (!isTaskAccessError(error)) {
				console.error(
					"Unexpected failure while validating Canva design access.",
					{
						taskId: args.taskId,
						taskLinkedActionId: args.taskLinkedActionId,
						error,
					},
				);
				throw error;
			}
		}
	}
	await requireVolunteerAction(ctx);
}

export const getCanvaOAuthUrl = action({
	args: {
		redirectUri: v.string(),
		codeChallenge: v.optional(v.string()),
		state: v.optional(v.string()),
		cliToken: v.optional(v.string()),
	},
	returns: v.object({
		url: v.string(),
		state: v.string(),
	}),
	handler: async (ctx, args) => {
		await requireVolunteerAction(ctx, args.cliToken);
		const clientId = getCanvaClientId();

		const state = args.state ?? crypto.randomUUID();
		const url = buildCanvaOAuthUrl({
			redirectUri: args.redirectUri,
			clientId,
			codeChallenge: args.codeChallenge,
			state,
		});

		return { url, state };
	},
});

export const exchangeCodeAndStoreTokens = action({
	args: {
		code: v.string(),
		redirectUri: v.string(),
		codeVerifier: v.optional(v.string()),
		cliToken: v.optional(v.string()),
	},
	returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
	handler: async (ctx, args) => {
		await requireVolunteerAction(ctx, args.cliToken);
		try {
			const token = await exchangeToken({
				grantType: "authorization_code",
				code: args.code,
				redirectUri: args.redirectUri,
				codeVerifier: args.codeVerifier,
			});
			await ctx.runMutation(internal.canvaQueries.setCanvaTokens, token);
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Canva OAuth failed.",
			};
		}
	},
});

export const listBrandTemplates = action({
	args: {
		query: v.optional(v.string()),
		continuation: v.optional(v.string()),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		items: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				url: v.union(v.string(), v.null()),
			}),
		),
		continuation: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, args) => {
		await requireCanvaPickerAccess(ctx);
		const accessToken = await getValidAccessToken(ctx);
		if (!accessToken) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message: "No Canva token. Run bun run auth:canva from repo root.",
			});
		}

		const client = createCanvaClient(accessToken);
		const data = await listBrandTemplatesApi(client, {
			query: args.query,
			continuation: args.continuation,
			limit: args.limit,
			dataset: "non_empty",
		});
		const items = mapBrandTemplatePickerItems(data);
		return {
			items,
			continuation: data.continuation ?? null,
		};
	},
});

export const listFolderItems = action({
	args: {
		folderId: v.optional(v.string()),
		continuation: v.optional(v.string()),
		limit: v.optional(v.number()),
		itemTypes: v.optional(
			v.array(
				v.union(v.literal("folder"), v.literal("design"), v.literal("image")),
			),
		),
		sortBy: v.optional(
			v.union(
				v.literal("created_ascending"),
				v.literal("created_descending"),
				v.literal("modified_ascending"),
				v.literal("modified_descending"),
				v.literal("title_ascending"),
				v.literal("title_descending"),
			),
		),
	},
	returns: v.object({
		items: v.array(
			v.object({
				type: v.union(
					v.literal("folder"),
					v.literal("design"),
					v.literal("image"),
				),
				id: v.string(),
				name: v.string(),
			}),
		),
		continuation: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, args) => {
		await requireCanvaPickerAccess(ctx);
		const accessToken = await getValidAccessToken(ctx);
		if (!accessToken) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message: "No Canva token. Run bun run auth:canva from repo root.",
			});
		}

		const client = createCanvaClient(accessToken);
		const data = await listFolderItemsApi(client, {
			folderId: args.folderId ?? "root",
			continuation: args.continuation,
			limit: args.limit,
			itemTypes: args.itemTypes,
			sortBy: args.sortBy,
		});

		const items = (data.items ?? [])
			.map((item) => {
				if (item.type === "folder" && item.folder) {
					return {
						type: "folder" as const,
						id: item.folder.id,
						name: item.folder.name ?? item.folder.id,
					};
				}
				if (item.type === "design" && item.design) {
					return {
						type: "design" as const,
						id: item.design.id,
						name: item.design.title ?? item.design.id,
					};
				}
				if (item.type === "image" && item.image) {
					return {
						type: "image" as const,
						id: item.image.id,
						name: item.image.name ?? item.image.id,
					};
				}
				return null;
			})
			.filter(
				(
					item,
				): item is {
					type: "folder" | "design" | "image";
					id: string;
					name: string;
				} => item !== null,
			);

		return {
			items,
			continuation: data.continuation ?? null,
		};
	},
});

export const validateFolderInput = action({
	args: {
		value: v.string(),
	},
	returns: v.object({
		id: v.string(),
		name: v.string(),
		path: v.string(),
	}),
	handler: async (ctx, args) => {
		await requireCanvaPickerAccess(ctx);
		const folderId = parseCanvaFolderInput(args.value);
		if (folderId === "root") {
			return {
				id: "root",
				name: "Root",
				path: "Root",
			};
		}

		const accessToken = await getValidAccessToken(ctx);
		if (!accessToken) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message: "No Canva token. Run bun run auth:canva from repo root.",
			});
		}
		const client = createCanvaClient(accessToken);
		try {
			const response = await getFolder(client, folderId);
			const name = response.folder?.name ?? folderId;
			return {
				id: folderId,
				name,
				path: name,
			};
		} catch (error) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message:
					error instanceof Error
						? error.message
						: "Could not validate Canva folder.",
			});
		}
	},
});

export const validateDesignInput = action({
	args: {
		value: v.string(),
		taskId: v.optional(v.id("tasks")),
		taskLinkedActionId: v.optional(v.id("taskLinkedActions")),
	},
	returns: v.object({
		id: v.string(),
		title: v.string(),
		url: v.string(),
		previewImageUrl: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, args) => {
		await requireCanvaDesignAccess(ctx, {
			taskId: args.taskId,
			taskLinkedActionId: args.taskLinkedActionId,
		});
		const designId = parseCanvaDesignInput(args.value);
		const accessToken = await getValidAccessToken(ctx);
		if (!accessToken) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message: "No Canva token. Run bun run auth:canva from repo root.",
			});
		}

		const client = createCanvaClient(accessToken);
		const designMeta = await getDesign(client, designId);
		const design = designMeta.design;
		if (!design) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Canva design not found.",
			});
		}
		const designUrl =
			design.urls?.edit_url ??
			design.urls?.view_url ??
			`https://www.canva.com/design/${designId}/edit`;

		return {
			id: designId,
			title: design.title ?? designId,
			url: designUrl,
			previewImageUrl: design.thumbnail?.url ?? null,
		};
	},
});

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const runTemplateAction = action({
	args: {
		sourceBrandTemplateId: v.string(),
		destinationFolderId: v.string(),
		outputTitle: v.string(),
		taskId: v.optional(v.id("tasks")),
		taskLinkedActionId: v.optional(v.id("taskLinkedActions")),
	},
	returns: v.object({
		designId: v.string(),
		title: v.string(),
		url: v.union(v.string(), v.null()),
		previewImageUrl: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, args) => {
		await requireCanvaRunAccess(ctx, {
			taskId: args.taskId,
			taskLinkedActionId: args.taskLinkedActionId,
		});
		const accessToken = await getValidAccessToken(ctx);
		if (!accessToken) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message: "No Canva token. Run bun run auth:canva from repo root.",
			});
		}

		const client = createCanvaClient(accessToken);
		const dataset = await getBrandTemplateDataset(
			client,
			args.sourceBrandTemplateId,
		);
		const hasAutofillFields = Boolean(
			dataset.dataset && Object.keys(dataset.dataset).length > 0,
		);
		if (!hasAutofillFields) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message:
					"Selected Canva template has no autofill-capable fields. Choose a template configured for autofill.",
			});
		}

		let competitionName: string | null = null;
		if (args.taskId && args.taskLinkedActionId) {
			const runContext = await ctx.runQuery(
				internal.linkedActions.getTaskLinkedActionRunContext,
				{
					taskId: args.taskId,
					taskLinkedActionId: args.taskLinkedActionId,
				},
			);
			competitionName = runContext?.competitionName ?? null;
		}
		const autofillData = buildCanvaAutofillData(
			dataset.dataset,
			competitionName,
		);

		const start = await createAutofillJob(client, {
			brandTemplateId: args.sourceBrandTemplateId,
			title: args.outputTitle,
			data: autofillData,
		});
		const jobId = start.job.id;

		let attempt = 0;
		while (attempt < 30) {
			const poll = await getAutofillJob(client, jobId);
			if (poll.job.status === "failed") {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: poll.job.error?.message ?? "Canva autofill job failed.",
				});
			}
			if (poll.job.status === "success") {
				const design = poll.job.result?.design;
				if (!design?.id) {
					throw new ConvexError({
						code: "BAD_REQUEST",
						message: "Canva returned success without design details.",
					});
				}

				if (args.destinationFolderId !== "root") {
					await moveFolderItem(client, {
						itemId: design.id,
						toFolderId: args.destinationFolderId,
					});
				}
				let previewImageUrl: string | null = design.thumbnail?.url ?? null;
				try {
					if (!previewImageUrl) {
						const designMeta = await getDesign(client, design.id);
						previewImageUrl = designMeta.design?.thumbnail?.url ?? null;
					}
				} catch {
					previewImageUrl = null;
				}
				const designUrl =
					design.url ?? design.urls?.edit_url ?? design.urls?.view_url ?? null;

				return {
					designId: design.id,
					title: design.title ?? args.outputTitle,
					url: designUrl,
					previewImageUrl,
				};
			}

			attempt += 1;
			await sleep(1000);
		}

		throw new ConvexError({
			code: "TIMEOUT",
			message: "Timed out waiting for Canva autofill job.",
		});
	},
});

export const getDesignMetadata = action({
	args: {
		designId: v.string(),
		taskId: v.optional(v.id("tasks")),
		taskLinkedActionId: v.optional(v.id("taskLinkedActions")),
	},
	returns: v.object({
		title: v.union(v.string(), v.null()),
		url: v.union(v.string(), v.null()),
		previewImageUrl: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, args) => {
		await requireCanvaDesignAccess(ctx, {
			taskId: args.taskId,
			taskLinkedActionId: args.taskLinkedActionId,
		});
		const accessToken = await getValidAccessToken(ctx);
		if (!accessToken) {
			throw new ConvexError({
				code: "PRECONDITION_FAILED",
				message: "No Canva token. Run bun run auth:canva from repo root.",
			});
		}
		const client = createCanvaClient(accessToken);
		const designMeta = await getDesign(client, args.designId);
		const design = designMeta.design;
		const url =
			design?.urls?.edit_url ??
			design?.urls?.view_url ??
			`https://www.canva.com/design/${args.designId}/edit`;
		return {
			title: design?.title ?? null,
			url,
			previewImageUrl: design?.thumbnail?.url ?? null,
		};
	},
});
