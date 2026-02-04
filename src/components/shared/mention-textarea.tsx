import { useMemo } from "react";
import {
	MentionRoot,
	MentionLabel,
	MentionInput,
	MentionPortal,
	MentionContent,
	MentionItem,
} from "@diceui/mention";
import type { User } from "@/data/types-new";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

interface MentionTextareaProps {
	value: string;
	onChange: ((value: string) => void) | ((e: React.ChangeEvent<HTMLTextAreaElement>) => void);
	placeholder?: string;
	className?: string;
	users: User[];
	currentUserId?: string;
	disabled?: boolean;
}

export function MentionTextarea({
	value,
	onChange,
	placeholder = "Type @ to mention someone...",
	className,
	users,
	currentUserId,
	disabled = false,
}: MentionTextareaProps) {
	const filteredUsers = useMemo(() => {
		return users.filter((u) => u.id !== currentUserId);
	}, [users, currentUserId]);

	const handleInputValueChange = (newValue: string) => {
		// Create a synthetic event object for handleChange from useDebouncedForm
		// which expects React.ChangeEvent<HTMLTextAreaElement> with e.target.value
		const syntheticEvent = {
			target: { value: newValue },
			currentTarget: { value: newValue },
		} as unknown as React.ChangeEvent<HTMLTextAreaElement>;

		// Call onChange with the synthetic event (works for useDebouncedForm.handleChange)
		(onChange as (e: React.ChangeEvent<HTMLTextAreaElement>) => void)(
			syntheticEvent,
		);
	};

	return (
		<MentionRoot
			trigger="@"
			inputValue={value}
			onInputValueChange={handleInputValueChange}
			disabled={disabled}
		>
			<MentionLabel className="sr-only">
				Comment input with mentions
			</MentionLabel>
			<MentionInput
				asChild
				disabled={disabled}
			>
				<textarea
					value={value}
					placeholder={placeholder}
					disabled={disabled}
					className={cn(
						"flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
				/>
			</MentionInput>
			<MentionPortal>
				<MentionContent
					className="z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
					side="top"
					align="start"
				>
					{filteredUsers.length === 0 ? (
						<div className="px-2 py-1.5 text-sm text-muted-foreground">
							No users found
						</div>
					) : (
						filteredUsers.map((user) => (
							<MentionItem
								key={user.id}
								value={user.name}
								className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
							>
								<Avatar className="size-6 mr-2">
									<AvatarImage src={user.avatarUrl || undefined} />
									<AvatarFallback className="text-xs">
										{getInitials(user.name)}
									</AvatarFallback>
								</Avatar>
								<span className="font-medium">{user.name}</span>
							</MentionItem>
						))
					)}
				</MentionContent>
			</MentionPortal>
		</MentionRoot>
	);
}
