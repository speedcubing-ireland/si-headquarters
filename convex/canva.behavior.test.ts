import { describe, expect, test } from "vitest";
import {
	buildCanvaAutofillData,
	buildCanvaDesignEditUrl,
	mapBrandTemplatePickerItems,
	parseCanvaDesignInput,
	parseCanvaFolderInput,
} from "./canva";

describe("canva brand template mapping", () => {
	test("parses Canva folder IDs and links", () => {
		expect(parseCanvaFolderInput("root")).toBe("root");
		expect(parseCanvaFolderInput("FAF-UVeKpXI")).toBe("FAF-UVeKpXI");
		expect(
			parseCanvaFolderInput("https://www.canva.com/folder/FAF-UVeKpXI"),
		).toBe("FAF-UVeKpXI");
	});

	test("parses Canva design IDs and links", () => {
		expect(parseCanvaDesignInput("DAG_bVVbgUM")).toBe("DAG_bVVbgUM");
		expect(
			parseCanvaDesignInput(
				"https://www.canva.com/design/DAG_bVVbgUM/ttYM-SpMZAY0znZpQSvfcQ/edit",
			),
		).toBe("DAG_bVVbgUM");
	});

	test("builds stable Canva edit URLs from design IDs", () => {
		expect(buildCanvaDesignEditUrl("DAG_bVVbgUM")).toBe(
			"https://www.canva.com/design/DAG_bVVbgUM/edit",
		);
	});

	test("maps flat Canva template item responses", () => {
		const items = mapBrandTemplatePickerItems({
			items: [
				{
					id: "EAHBTxzqcfg",
					title: "Cert Template",
					view_url: "https://www.canva.com/brand/brand-templates/EAHBTxzqcfg",
					create_url:
						"https://www.canva.com/design?create=true&template=EAHBTxzqcfg",
				},
			],
		});

		expect(items).toEqual([
			{
				id: "EAHBTxzqcfg",
				title: "Cert Template",
				url: "https://www.canva.com/brand/brand-templates/EAHBTxzqcfg",
			},
		]);
	});

	test("maps wrapped brand_template responses", () => {
		const items = mapBrandTemplatePickerItems({
			items: [
				{
					brand_template: {
						id: "tpl_1",
						title: "Wrapped Template",
						url: "https://www.canva.com/design/tpl_1/view",
					},
				},
			],
		});

		expect(items).toEqual([
			{
				id: "tpl_1",
				title: "Wrapped Template",
				url: "https://www.canva.com/design/tpl_1/view",
			},
		]);
	});

	test("builds autofill payload with blanks and COMP_ID mapping", () => {
		const payload = buildCanvaAutofillData(
			{
				COMP_ID: { type: "text" },
				RECIPIENT_NAME: { type: "text" },
			},
			"Irish Open 2026",
		);

		expect(payload).toEqual({
			COMP_ID: { type: "text", text: "Irish Open 2026" },
			RECIPIENT_NAME: { type: "text", text: "" },
		});
	});

	test("maps COMP_ID case-insensitively", () => {
		const payload = buildCanvaAutofillData(
			{
				comp_id: { type: "text" },
				OTHER: { type: "text" },
			},
			"Nationals",
		);

		expect(payload).toEqual({
			comp_id: { type: "text", text: "Nationals" },
			OTHER: { type: "text", text: "" },
		});
	});

	test("omits non-text dataset fields", () => {
		const payload = buildCanvaAutofillData(
			{
				COMP_ID: { type: "text" },
				LOGO: { type: "image" },
				STATS: { type: "chart" },
			},
			"Irish Open 2026",
		);

		expect(payload).toEqual({
			COMP_ID: { type: "text", text: "Irish Open 2026" },
		});
	});
});
