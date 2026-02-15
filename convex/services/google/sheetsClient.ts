"use node";

import { google } from "googleapis";

export async function fetchGoogleSheetValues(args: {
	accessToken: string;
	spreadsheetId: string;
	range: string;
}): Promise<string[][]> {
	const oauth2 = new google.auth.OAuth2();
	oauth2.setCredentials({ access_token: args.accessToken });

	const sheets = google.sheets({ version: "v4", auth: oauth2 });
	const response = await sheets.spreadsheets.values.get({
		spreadsheetId: args.spreadsheetId,
		range: args.range,
	});
	return (response.data.values ?? []) as string[][];
}
