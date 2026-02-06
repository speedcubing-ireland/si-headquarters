import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ConvexError } from "convex/values";
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Extract a user-facing message from a Convex mutation error.
 */
function getErrorMessage(error: unknown): string {
	if (error instanceof ConvexError) {
		const data = error.data;
		if (typeof data === "string") return data;
		if (data && typeof data === "object" && "message" in data) {
			return String(data.message);
		}
		return "Something went wrong";
	}
	if (error instanceof Error) return error.message;
	return "Something went wrong";
}

/**
 * Show an error toast for a failed mutation. Use as `.catch(onMutationError)`.
 */
export function onMutationError(error: unknown): void {
	toast.error(getErrorMessage(error));
}
