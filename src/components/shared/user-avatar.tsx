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
	user?: User | null;

	name?: string;

	avatarUrl?: string;

	size?: UserAvatarSize;

	className?: string;

	showName?: boolean;

	nameClassName?: string;

	alt?: string;
}

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
			<div className="flex min-w-0 items-center gap-1.5">
				{avatar}
				<span className={cn("min-w-0 truncate text-xs", nameClassName)}>
					{displayName}
				</span>
			</div>
		);
	}

	return avatar;
}
