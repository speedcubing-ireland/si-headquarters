import { describe, expect, test, vi } from "vitest";
import { listBrandTemplates, listFolderItems } from "./canvaClient";

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
			GET: vi.fn().mockResolvedValue({ data, error: undefined }),
		};

		const result = await listBrandTemplates(client as never, {
			query: "cert",
			continuation: "cursor-1",
			limit: 25,
			dataset: "non_empty",
		});

		expect(client.GET).toHaveBeenCalledWith("/v1/brand-templates", {
			params: {
				query: {
					query: "cert",
					continuation: "cursor-1",
					limit: 25,
					dataset: "non_empty",
				},
			},
		});
		expect(result).toEqual(data);
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
			GET: vi.fn().mockResolvedValue({ data, error: undefined }),
		};

		const result = await listFolderItems(client as never, {
			folderId: "root",
			continuation: "cursor-2",
			limit: 50,
			itemTypes: ["folder"],
			sortBy: "title_ascending",
		});

		expect(client.GET).toHaveBeenCalledWith("/v1/folders/{folderId}/items", {
			params: {
				path: { folderId: "root" },
				query: {
					continuation: "cursor-2",
					limit: 50,
					item_types: ["folder"],
					sort_by: "title_ascending",
				},
			},
		});
		expect(result).toEqual(data);
	});
});
