export function formatCompetitionName(name: string): string {
	const words = name.trim().split(/\s+/);
	const initials = words
		.map((word) => {
			if (/^\d{4}$/.test(word)) return "";
			const match = word.match(/[A-Z]/);
			return match ? match[0] : word[0]?.toUpperCase() || "";
		})
		.filter(Boolean)
		.join("");

	const yearMatches = name.match(/\b(\d{4})\b/g);
	const year = yearMatches ? yearMatches[yearMatches.length - 1].slice(-2) : "";

	return year ? `${initials}${year}` : initials;
}
