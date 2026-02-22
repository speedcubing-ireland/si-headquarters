export function getConvexErrorMessage(error: unknown): string {
	if (
		typeof error === "object" &&
		error !== null &&
		"data" in error &&
		typeof error.data === "string"
	) {
		try {
			const parsed = JSON.parse(error.data) as { message?: unknown };
			if (typeof parsed.message === "string") {
				return parsed.message;
			}
		} catch {
			return error.data;
		}
	}
	if (
		typeof error === "object" &&
		error !== null &&
		"data" in error &&
		typeof error.data === "object" &&
		error.data !== null &&
		"message" in error.data &&
		typeof error.data.message === "string"
	) {
		return error.data.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

export function getConvexErrorCode(error: unknown): string | null {
	if (
		typeof error === "object" &&
		error !== null &&
		"data" in error &&
		typeof error.data === "string"
	) {
		try {
			const parsed = JSON.parse(error.data) as { code?: unknown };
			return typeof parsed.code === "string" ? parsed.code : null;
		} catch {
			return null;
		}
	}
	if (
		typeof error === "object" &&
		error !== null &&
		"data" in error &&
		typeof error.data === "object" &&
		error.data !== null &&
		"code" in error.data &&
		typeof error.data.code === "string"
	) {
		return error.data.code;
	}
	return null;
}

export async function captureError(
	callback: () => Promise<unknown>,
): Promise<unknown> {
	try {
		await callback();
		return null;
	} catch (error) {
		return error;
	}
}
