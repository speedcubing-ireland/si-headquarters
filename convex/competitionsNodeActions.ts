"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { getServiceAccessToken } from "./services/tokens/runtime";
import { fetchGoogleSheetTitle } from "./services/google/sheetsClient";
import { checkResourceNamingGuard } from "./lib/deploymentGuard";

export const checkSheetNamingGuard = internalAction({
	args: { sheetId: v.string() },
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, { sheetId }) => {
		const googleToken = await getServiceAccessToken(ctx, "google");
		if (!googleToken) return null;
		return await checkResourceNamingGuard({
			resourceType: "Google Sheet",
			resourceId: sheetId,
			fetchResourceName: () =>
				fetchGoogleSheetTitle({
					accessToken: googleToken,
					spreadsheetId: sheetId,
				}),
		});
	},
});
