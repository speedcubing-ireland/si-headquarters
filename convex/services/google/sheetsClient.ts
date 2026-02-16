"use node";

import { google } from "googleapis";

export type GoogleSheetCellValue = string | number | boolean | null;

function createSheetsClient(accessToken: string) {
	const oauth2 = new google.auth.OAuth2();
	oauth2.setCredentials({ access_token: accessToken });
	return google.sheets({ version: "v4", auth: oauth2 });
}

function createDriveClient(accessToken: string) {
	const oauth2 = new google.auth.OAuth2();
	oauth2.setCredentials({ access_token: accessToken });
	return google.drive({ version: "v3", auth: oauth2 });
}

export async function fetchGoogleSheetValues(args: {
	accessToken: string;
	spreadsheetId: string;
	range: string;
}): Promise<string[][]> {
	const sheets = createSheetsClient(args.accessToken);
	const response = await sheets.spreadsheets.values.get({
		spreadsheetId: args.spreadsheetId,
		range: args.range,
	});
	return (response.data.values ?? []) as string[][];
}

export async function clearGoogleSheetValues(args: {
	accessToken: string;
	spreadsheetId: string;
	range: string;
}): Promise<void> {
	const sheets = createSheetsClient(args.accessToken);
	await sheets.spreadsheets.values.clear({
		spreadsheetId: args.spreadsheetId,
		range: args.range,
	});
}

export async function updateGoogleSheetValues(args: {
	accessToken: string;
	spreadsheetId: string;
	range: string;
	values: GoogleSheetCellValue[][];
}): Promise<void> {
	const sheets = createSheetsClient(args.accessToken);
	await sheets.spreadsheets.values.update({
		spreadsheetId: args.spreadsheetId,
		range: args.range,
		valueInputOption: "RAW",
		requestBody: {
			values: args.values,
		},
	});
}

export async function shareGoogleSheetWithUser(args: {
	accessToken: string;
	spreadsheetId: string;
	email: string;
	role?: "writer" | "reader" | "commenter";
	notificationMessage?: string;
}): Promise<void> {
	const drive = createDriveClient(args.accessToken);
	await drive.permissions.create({
		fileId: args.spreadsheetId,
		supportsAllDrives: true,
		sendNotificationEmail: true,
		emailMessage: args.notificationMessage,
		requestBody: {
			type: "user",
			role: args.role ?? "writer",
			emailAddress: args.email,
		},
	});
}
