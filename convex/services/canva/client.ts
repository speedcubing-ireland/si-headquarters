"use node";

import createClient from "openapi-fetch";
import type { components, paths } from "./api/types";

type ErrorBody = {
	code?: string;
	message?: string;
	error?: string;
	error_description?: string;
};

export type CanvaBrandTemplateSummary = components["schemas"]["BrandTemplate"];
type BrandTemplatesListBody =
	components["schemas"]["ListBrandTemplatesResponse"];
type BrandTemplateDatasetBody =
	components["schemas"]["GetBrandTemplateDatasetResponse"];
type FolderItemsListBody = components["schemas"]["ListFolderItemsResponse"];
type FolderGetBody = components["schemas"]["GetFolderResponse"];
type DesignGetBody = components["schemas"]["GetDesignResponse"];
type CreateAutofillJobBody =
	components["schemas"]["CreateDesignAutofillJobResponse"];
type AutofillJobBody = components["schemas"]["GetDesignAutofillJobResponse"];
type FolderItemType = components["schemas"]["FolderItemType"];
type FolderItemSortBy = components["schemas"]["FolderItemSortBy"];
type DatasetFilter = components["schemas"]["DatasetFilter"];
type CanvaDataset = components["schemas"]["Dataset"];

export type CanvaClient = ReturnType<typeof createClient<paths>>;

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
	return createClient<paths>({
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
		dataset?: DatasetFilter;
	},
): Promise<BrandTemplatesListBody> {
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
): Promise<BrandTemplateDatasetBody> {
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
		itemTypes?: FolderItemType[];
		sortBy?: FolderItemSortBy;
	},
): Promise<FolderItemsListBody> {
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

export async function getFolder(
	client: CanvaClient,
	folderId: string,
): Promise<FolderGetBody> {
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

export async function getDesign(
	client: CanvaClient,
	designId: string,
): Promise<DesignGetBody> {
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
		title?: string;
		data?: CanvaDataset;
	},
): Promise<CreateAutofillJobBody> {
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

export async function getAutofillJob(
	client: CanvaClient,
	jobId: string,
): Promise<AutofillJobBody> {
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
