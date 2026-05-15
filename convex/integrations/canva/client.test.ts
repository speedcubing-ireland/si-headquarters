import { describe, expect, test, vi } from "vitest";
import {
	listBrandTemplates as listBrandTemplatesApi,
	listFolderItems as listFolderItemsApi,
} from "./client/client/sdk.gen";

describe("canvaClient", () => {
	test("listBrandTemplates forwards pagination arguments", async () => {
		const data = {
			items: [
				{
					brand_template: {
						id: "tpl_1",
						title: "Certificates",
						url: "https://www.canva.com/design/tpl_1/view",
					},
				},
			],
			continuation: "next-page",
		};
		const client = {
			get: vi.fn().mockResolvedValue({ data, error: undefined }),
		};

		const result = await listBrandTemplatesApi({
			client: client as never,
			query: {
				query: "cert",
				continuation: "cursor-1",
				limit: 25,
				dataset: "non_empty",
			},
		});

		expect(client.get).toHaveBeenCalledWith(
			expect.objectContaining({
				url: "/v1/brand-templates",
				query: {
					query: "cert",
					continuation: "cursor-1",
					limit: 25,
					dataset: "non_empty",
				},
			}),
		);
		expect(result.data).toEqual(data);
	});

	test("listFolderItems forwards folder filters and sorting", async () => {
		const data = {
			items: [
				{
					type: "folder" as const,
					folder: { id: "folder_1", name: "Certificates" },
				},
			],
			continuation: "next-folder-page",
		};
		const client = {
			get: vi.fn().mockResolvedValue({ data, error: undefined }),
		};

		const result = await listFolderItemsApi({
			client: client as never,
			path: { folderId: "root" },
			query: {
				continuation: "cursor-2",
				limit: 50,
				item_types: ["folder"],
				sort_by: "title_ascending",
			},
		});

		expect(client.get).toHaveBeenCalledWith(
			expect.objectContaining({
				url: "/v1/folders/{folderId}/items",
				path: { folderId: "root" },
				query: {
					continuation: "cursor-2",
					limit: 50,
					item_types: ["folder"],
					sort_by: "title_ascending",
				},
			}),
		);
		expect(result.data).toEqual(data);
	});
});
