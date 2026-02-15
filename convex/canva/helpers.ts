"use node";

import { ConvexError } from "convex/values";
import type { components } from "../services/canva/api/types";

type BrandTemplateApiItem = Pick<components["schemas"]["BrandTemplate"], "id"> &
	Partial<
		Pick<
			components["schemas"]["BrandTemplate"],
			"title" | "view_url" | "create_url"
		>
	> & {
		url?: string;
	};

type BrandTemplateApiResponse = {
	continuation?: components["schemas"]["ListBrandTemplatesResponse"]["continuation"];
	items?: Array<
		BrandTemplateApiItem | { brand_template?: BrandTemplateApiItem }
	>;
};

type BrandTemplateDataset = components["schemas"]["DatasetDefinition"];
type AutofillTextValue = components["schemas"]["DatasetTextValue"];

function isWrappedBrandTemplateItem(
	item: BrandTemplateApiItem | { brand_template?: BrandTemplateApiItem },
): item is { brand_template?: BrandTemplateApiItem } {
	return "brand_template" in item;
}

function extractBrandTemplateItem(
	item: BrandTemplateApiItem | { brand_template?: BrandTemplateApiItem },
): BrandTemplateApiItem | null {
	if (isWrappedBrandTemplateItem(item)) {
		return item.brand_template ?? null;
	}
	return item;
}

export function mapBrandTemplatePickerItems(data: BrandTemplateApiResponse) {
	return (data.items ?? [])
		.map(extractBrandTemplateItem)
		.filter((template): template is BrandTemplateApiItem => template !== null)
		.map((template) => ({
			id: template.id,
			title: template.title ?? template.id,
			url: template.view_url ?? template.url ?? template.create_url ?? null,
		}));
}

export function buildCanvaAutofillData(
	dataset: BrandTemplateDataset | undefined,
	competitionName: string | null | undefined,
): Record<string, AutofillTextValue> {
	if (!dataset) return {};

	const compIdValue = competitionName?.trim() ?? "";
	return Object.entries(dataset).reduce<Record<string, AutofillTextValue>>(
		(acc, [fieldKey, field]) => {
			if (field.type !== "text") return acc;
			acc[fieldKey] = {
				type: "text",
				text: fieldKey.toUpperCase() === "COMP_ID" ? compIdValue : "",
			};
			return acc;
		},
		{},
	);
}

export function buildCanvaDesignEditUrl(designId: string): string {
	return `https://www.canva.com/design/${encodeURIComponent(designId.trim())}/edit`;
}

function parseCanvaFolderIdFromUrl(raw: string): string | null {
	try {
		const url = new URL(raw);
		if (!url.hostname.includes("canva.com")) return null;
		const segments = url.pathname
			.split("/")
			.map((segment) => segment.trim())
			.filter((segment) => segment.length > 0);
		const folderIndex = segments.indexOf("folder");
		const folderId = segments[folderIndex + 1];
		return folderId ? decodeURIComponent(folderId) : null;
	} catch {
		return null;
	}
}

const CANVA_FOLDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;
const CANVA_DESIGN_ID_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;

function parseCanvaDesignIdFromUrl(raw: string): string | null {
	try {
		const url = new URL(raw);
		if (!url.hostname.includes("canva.com")) return null;
		const segments = url.pathname
			.split("/")
			.map((segment) => segment.trim())
			.filter((segment) => segment.length > 0);
		const designIndex = segments.indexOf("design");
		const designId = segments[designIndex + 1];
		return designId ? decodeURIComponent(designId) : null;
	} catch {
		return null;
	}
}

export function parseCanvaFolderInput(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Folder value is required.",
		});
	}
	if (trimmed === "root") return "root";

	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		const folderId = parseCanvaFolderIdFromUrl(trimmed);
		if (!folderId) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Folder URL must look like https://www.canva.com/folder/<id>",
			});
		}
		return folderId;
	}

	if (!CANVA_FOLDER_ID_PATTERN.test(trimmed)) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Folder must be a Canva folder ID or Canva folder URL.",
		});
	}
	return trimmed;
}

export function parseCanvaDesignInput(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Design value is required.",
		});
	}

	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		const designId = parseCanvaDesignIdFromUrl(trimmed);
		if (!designId) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "Design URL must look like https://www.canva.com/design/<id>",
			});
		}
		return designId;
	}

	if (!CANVA_DESIGN_ID_PATTERN.test(trimmed)) {
		throw new ConvexError({
			code: "BAD_REQUEST",
			message: "Design must be a Canva design ID or Canva design URL.",
		});
	}
	return trimmed;
}
