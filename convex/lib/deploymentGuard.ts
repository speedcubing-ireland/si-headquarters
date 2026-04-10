const PRODUCTION_WCA_URLS = ["https://www.worldcubeassociation.org"];

const NON_PRODUCTION_RESOURCE_PREFIX = "[DEV]";

export function isProductionDeployment(): boolean {
	return process.env.DEPLOYMENT_CONTEXT === "production";
}

export function getRequiredResourcePrefix(): string | undefined {
	if (isProductionDeployment()) return undefined;
	return NON_PRODUCTION_RESOURCE_PREFIX;
}

export function validateResourcePrefix(
	resourceName: string,
	requiredPrefix: string,
): string | null {
	if (resourceName.startsWith(requiredPrefix)) return null;
	return `Resource name "${resourceName}" does not start with required prefix "${requiredPrefix}".`;
}

/**
 * Cross-validation for non-production deployments. Returns the hardcoded
 * resource prefix "[DEV]". Throws when WCA_BASE_URL resolves to a production
 * WCA URL.
 */
export function validateNonProductionEnvironment(): string {
	const wcaUrl =
		process.env.WCA_BASE_URL ?? "https://www.worldcubeassociation.org";
	if (PRODUCTION_WCA_URLS.includes(wcaUrl)) {
		throw new Error(
			"Non-production deployment safety check failed: " +
				`WCA_BASE_URL is set to "${wcaUrl}" (production URL). ` +
				"In non-production deployments, WCA_BASE_URL must point to a staging/dev WCA instance. " +
				"Set WCA_BASE_URL to your staging URL or set DEPLOYMENT_CONTEXT=production if this is intentional.",
		);
	}

	return NON_PRODUCTION_RESOURCE_PREFIX;
}

/**
 * Returns `title` prefixed with "[DEV]" in non-production, unchanged in
 * production. Does not throw — just prepends the prefix if missing.
 */
export function applyResourcePrefix(title: string): string {
	const prefix = getRequiredResourcePrefix();
	if (!prefix) return title;
	if (title.startsWith(prefix)) return title;
	return `${prefix} ${title}`;
}

export async function checkResourceNamingGuard(args: {
	resourceType: "Google Sheet";
	resourceId: string;
	fetchResourceName: () => Promise<string>;
}): Promise<string | null> {
	if (isProductionDeployment()) return null;

	const prefix = validateNonProductionEnvironment();
	const name = await args.fetchResourceName();
	const error = validateResourcePrefix(name, prefix);
	if (error) {
		return (
			`Resource name must start with "${prefix}" in non-production deployments. ` +
			`Rename the resource to "${prefix} ${name}" or verify you are targeting the correct resource.`
		);
	}
	return null;
}
