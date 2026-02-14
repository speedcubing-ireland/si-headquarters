import { describe, expect, test } from "vitest";
import { canCreateLinkedActionDraft } from "@/components/admin/linked-actions-section";

const BASE_CANVA_CONFIG = {
	sourceBrandTemplateId: "",
	destinationFolderId: "",
	naming: {
		mode: "parent_plus_suffix" as const,
		defaultSuffix: "Certificates",
	},
};

describe("canCreateLinkedActionDraft", () => {
	test("requires template and folder for canva type", () => {
		expect(
			canCreateLinkedActionDraft({
				type: "canva_template",
				name: "Certificates",
				shortId: "canva.certificates",
				canvaConfig: BASE_CANVA_CONFIG,
			}),
		).toBe(false);

		expect(
			canCreateLinkedActionDraft({
				type: "canva_template",
				name: "Certificates",
				shortId: "canva.certificates",
				canvaConfig: {
					...BASE_CANVA_CONFIG,
					sourceBrandTemplateId: "DAG_bVVbgUM",
					destinationFolderId: "FAF-UVeKpXI",
				},
			}),
		).toBe(true);
	});

	test("allows linked sheet without canva selection", () => {
		expect(
			canCreateLinkedActionDraft({
				type: "linked_sheet",
				name: "Transfer schedule",
				shortId: "sheet.transfer-wca",
				canvaConfig: BASE_CANVA_CONFIG,
			}),
		).toBe(true);
	});
});
