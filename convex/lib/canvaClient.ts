"use node";

import createClient from "openapi-fetch";

type ErrorBody = {
	code?: string;
	message?: string;
	error?: string;
	error_description?: string;
};

export type CanvaBrandTemplateSummary = {
	id: string;
	title?: string;
	url?: string;
	view_url?: string;
	create_url?: string;
	created_at?: number;
	updated_at?: number;
};

type BrandTemplatesListBody = {
	items: Array<
		CanvaBrandTemplateSummary | { brand_template?: CanvaBrandTemplateSummary }
	>;
	continuation?: string;
};

type BrandTemplateDatasetBody = {
	dataset?: Record<string, { type?: "image" | "text" | "chart" }>;
};

type FolderItemFolder = {
	type: "folder";
	folder?: { id: string; name?: string };
};

type FolderItemDesign = {
	type: "design";
	design?: { id: string; title?: string };
};

type FolderItemImage = {
	type: "image";
	image?: { id: string; name?: string };
};

type FolderItemsListBody = {
	items: Array<FolderItemFolder | FolderItemDesign | FolderItemImage>;
	continuation?: string;
};

type FolderGetBody = {
	folder?: {
		id: string;
		name?: string;
	};
};

type DesignGetBody = {
	design?: {
		id: string;
		title?: string;
		url?: string;
		urls?: {
			edit_url?: string;
			view_url?: string;
		};
		thumbnail?: {
			url?: string;
		};
	};
};

type AutofillJobBody = {
	job: {
		id: string;
		status: "in_progress" | "success" | "failed";
		result?: {
			type: "create_design";
			design?: {
				id: string;
				title?: string;
				url?: string;
				urls?: {
					edit_url?: string;
					view_url?: string;
				};
				thumbnail?: {
					url?: string;
				};
			};
		};
		error?: {
			code?: string;
			message?: string;
		};
	};
};

interface CanvaPaths {
	"/v1/brand-templates": {
		get: {
			parameters: {
				query?: {
					query?: string;
					continuation?: string;
					limit?: number;
					dataset?: "any" | "non_empty";
				};
			};
			responses: {
				200: { content: { "application/json": BrandTemplatesListBody } };
			};
		};
	};
	"/v1/brand-templates/{brandTemplateId}/dataset": {
		get: {
			parameters: {
				path: { brandTemplateId: string };
			};
			responses: {
				200: { content: { "application/json": BrandTemplateDatasetBody } };
			};
		};
	};
	"/v1/folders/{folderId}/items": {
		get: {
			parameters: {
				path: { folderId: string };
				query?: {
					continuation?: string;
					limit?: number;
					item_types?: Array<"folder" | "design" | "image">;
					sort_by?:
						| "created_ascending"
						| "created_descending"
						| "modified_ascending"
						| "modified_descending"
						| "title_ascending"
						| "title_descending";
				};
			};
			responses: {
				200: { content: { "application/json": FolderItemsListBody } };
			};
		};
	};
	"/v1/folders/{folderId}": {
		get: {
			parameters: {
				path: { folderId: string };
			};
			responses: {
				200: { content: { "application/json": FolderGetBody } };
			};
		};
	};
	"/v1/designs/{designId}": {
		get: {
			parameters: {
				path: { designId: string };
			};
			responses: {
				200: { content: { "application/json": DesignGetBody } };
			};
		};
	};
	"/v1/autofills": {
		post: {
			requestBody: {
				content: {
					"application/json": {
						brand_template_id: string;
						title?: string;
						data: Record<string, unknown>;
					};
				};
			};
			responses: {
				200: { content: { "application/json": AutofillJobBody } };
			};
		};
	};
	"/v1/autofills/{jobId}": {
		get: {
			parameters: {
				path: { jobId: string };
			};
			responses: {
				200: { content: { "application/json": AutofillJobBody } };
			};
		};
	};
	"/v1/folders/move": {
		post: {
			requestBody: {
				content: {
					"application/json": {
						to_folder_id: string;
						item_id: string;
					};
				};
			};
			responses: {
				204: never;
			};
		};
	};
}

type CanvaClient = ReturnType<typeof createClient<CanvaPaths>>;

function getErrorMessage(error: ErrorBody | undefined): string {
	if (!error) return "Unknown Canva API error";
	return (
		error.message ??
		error.error_description ??
		error.error ??
		error.code ??
		"Unknown Canva API error"
	);
}

export function createCanvaClient(accessToken: string): CanvaClient {
	return createClient<CanvaPaths>({
		baseUrl: "https://api.canva.com/rest",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
	});
}

export async function listBrandTemplates(
	client: CanvaClient,
	args: {
		query?: string;
		continuation?: string;
		limit?: number;
		dataset?: "any" | "non_empty";
	},
) {
	const { data, error } = await client.GET("/v1/brand-templates", {
		params: {
			query: {
				query: args.query,
				continuation: args.continuation,
				limit: args.limit ?? 50,
				dataset: args.dataset,
			},
		},
	});
	if (error) {
		throw new Error(`Canva list templates failed: ${getErrorMessage(error)}`);
	}
	return data;
}

export async function getBrandTemplateDataset(
	client: CanvaClient,
	brandTemplateId: string,
) {
	const { data, error } = await client.GET(
		"/v1/brand-templates/{brandTemplateId}/dataset",
		{
			params: {
				path: { brandTemplateId },
			},
		},
	);
	if (error) {
		throw new Error(
			`Canva get brand template dataset failed: ${getErrorMessage(error)}`,
		);
	}
	return data;
}

export async function listFolderItems(
	client: CanvaClient,
	args: {
		folderId: string;
		continuation?: string;
		limit?: number;
		itemTypes?: Array<"folder" | "design" | "image">;
		sortBy?:
			| "created_ascending"
			| "created_descending"
			| "modified_ascending"
			| "modified_descending"
			| "title_ascending"
			| "title_descending";
	},
) {
	const { data, error } = await client.GET("/v1/folders/{folderId}/items", {
		params: {
			path: { folderId: args.folderId },
			query: {
				continuation: args.continuation,
				limit: args.limit ?? 100,
				item_types: args.itemTypes,
				sort_by: args.sortBy,
			},
		},
	});
	if (error) {
		throw new Error(
			`Canva list folder items failed: ${getErrorMessage(error)}`,
		);
	}
	return data;
}

export async function getFolder(client: CanvaClient, folderId: string) {
	const { data, error } = await client.GET("/v1/folders/{folderId}", {
		params: {
			path: { folderId },
		},
	});
	if (error) {
		throw new Error(`Canva get folder failed: ${getErrorMessage(error)}`);
	}
	return data;
}

export async function getDesign(client: CanvaClient, designId: string) {
	const { data, error } = await client.GET("/v1/designs/{designId}", {
		params: {
			path: { designId },
		},
	});
	if (error) {
		throw new Error(`Canva get design failed: ${getErrorMessage(error)}`);
	}
	return data;
}

export async function createAutofillJob(
	client: CanvaClient,
	args: {
		brandTemplateId: string;
		title: string;
		data?: Record<string, unknown>;
	},
) {
	const { data, error } = await client.POST("/v1/autofills", {
		body: {
			brand_template_id: args.brandTemplateId,
			title: args.title,
			data: args.data ?? {},
		},
	});
	if (error) {
		throw new Error(`Canva autofill start failed: ${getErrorMessage(error)}`);
	}
	return data;
}

export async function getAutofillJob(client: CanvaClient, jobId: string) {
	const { data, error } = await client.GET("/v1/autofills/{jobId}", {
		params: {
			path: { jobId },
		},
	});
	if (error) {
		throw new Error(`Canva autofill poll failed: ${getErrorMessage(error)}`);
	}
	return data;
}

export async function moveFolderItem(
	client: CanvaClient,
	args: { itemId: string; toFolderId: string },
) {
	const { error } = await client.POST("/v1/folders/move", {
		body: {
			item_id: args.itemId,
			to_folder_id: args.toFolderId,
		},
	});
	if (error) {
		throw new Error(`Canva move item failed: ${getErrorMessage(error)}`);
	}
}
