import { shapes } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

export function buildDefaultAvatarUrl(seed: string): string {
	return createAvatar(shapes, { seed }).toDataUri();
}
