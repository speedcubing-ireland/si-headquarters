import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/data/types-new";
import { getInitials } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

type UserAvatarSize = "xs" | "sm" | "md" | "lg";

const sizeClasses: Record<
	UserAvatarSize,
	{ avatar: string; fallback: string }
> = {
	xs: { avatar: "size-4", fallback: "text-[10px]" },
	sm: { avatar: "size-5", fallback: "text-xs" },
	md: { avatar: "size-6", fallback: "text-xs" },
	lg: { avatar: "size-8", fallback: "text-sm" },
};

export interface UserAvatarProps {
	/**
	 * User object with id, name, and avatarUrl. If provided, uses these values.
	 */
	user?: User | null;
	/**
	 * User name as a string. Used when user object is not available.
	 * If both user and name are provided, user takes precedence.
	 */
	name?: string;
	/**
	 * Avatar image URL. If provided, overrides user.avatarUrl.
	 */
	avatarUrl?: string;
	/**
	 * Size variant for the avatar.
	 * @default "sm"
	 */
	size?: UserAvatarSize;
	/**
	 * Custom className for the avatar container.
	 */
	className?: string;
	/**
	 * Whether to show the user's name next to the avatar.
	 * @default false
	 */
	showName?: boolean;
	/**
	 * Custom className for the name text when showName is true.
	 */
	nameClassName?: string;
	/**
	 * Alt text for the avatar image. Defaults to name or "User avatar".
	 */
	alt?: string;
}

/**
 * Reusable component for rendering user avatars with fallback initials.
 * Supports both User objects and string names, with configurable sizes and optional name display.
 */
export function UserAvatar({
	user,
	name: nameProp,
	avatarUrl: avatarUrlProp,
	size = "sm",
	className,
	showName = false,
	nameClassName,
	alt,
}: UserAvatarProps) {
	const displayName = user?.name ?? nameProp ?? "";
	const displayAvatarUrl = avatarUrlProp ?? user?.avatarUrl;
	const displayAlt = alt ?? displayName ?? "User avatar";

	const sizeConfig = sizeClasses[size];

	const avatar = (
		<Avatar className={cn(sizeConfig.avatar, className)}>
			<AvatarImage src={displayAvatarUrl} alt={displayAlt} />
			<AvatarFallback className={sizeConfig.fallback}>
				{getInitials(displayName)}
			</AvatarFallback>
		</Avatar>
	);

	if (showName) {
		return (
			<div className="flex items-center gap-1.5">
				{avatar}
				<span className={cn("text-xs", nameClassName)}>{displayName}</span>
			</div>
		);
	}

	return avatar;
}
