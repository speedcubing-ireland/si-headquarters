import { requireVolunteerAction } from "../lib/oauth";

export { requireVolunteerAction };

export const WCA_BASE = "https://www.worldcubeassociation.org";
export const WCA_API = `${WCA_BASE}/api/v0`;
export const WCA_OAUTH_SCOPE = "public email manage_competitions";

export const SEARCH_RESULTS_LIMIT = 10;
export const MY_COMPETITIONS_LIMIT = 20;

export async function wcaFetch(
	accessToken: string,
	path: string,
): Promise<unknown> {
	const res = await fetch(`${WCA_API}${path}`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!res.ok) {
		throw new Error(`WCA API ${path} failed: ${res.status} ${res.statusText}`);
	}
	return res.json();
}

export function mapCompetitionResult(c: {
	id: string;
	name: string;
	city: string;
	country_iso2: string;
	start_date: string;
	end_date: string;
	event_ids: string[];
}) {
	return {
		id: c.id,
		name: c.name,
		city: c.city ?? "",
		country_iso2: c.country_iso2 ?? "",
		start_date: c.start_date ?? "",
		end_date: c.end_date ?? "",
		event_ids: c.event_ids ?? [],
	};
}
