import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ConvexError } from "convex/values";
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Extract code and message from ConvexError for use in UI or custom error messages. */
export function getConvexErrorData(error: unknown): {
	code?: string;
	message?: string;
} {
	if (
		typeof error === "object" &&
		error !== null &&
		"data" in error &&
		typeof (error as { data: unknown }).data === "string"
	) {
		try {
			return JSON.parse((error as { data: string }).data) as {
				code?: string;
				message?: string;
			};
		} catch {
			return {};
		}
	}
	if (
		error instanceof ConvexError &&
		typeof error.data === "object" &&
		error.data !== null
	) {
		const data = error.data as { code?: string; message?: string };
		return {
			...(typeof data.code === "string" && { code: data.code }),
			...(typeof data.message === "string" && { message: data.message }),
		};
	}
	return {};
}

function getErrorMessage(error: unknown): string {
	const data = getConvexErrorData(error);
	if (data.message) return data.message;
	if (error instanceof Error) return error.message;
	return "Something went wrong";
}

export function onMutationError(error: unknown): void {
	toast.error(getErrorMessage(error));
}

export function pickDefined<T extends Record<string, unknown>>(
	obj: T,
): Partial<T> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== undefined) result[key] = value;
	}
	return result as Partial<T>;
}
