"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";

interface EditableTextProps {
	value: string;
	placeholder?: string;
	className?: string;
	displayClassName?: string;
	onSubmit: (next: string) => void;
}

export function EditableText({
	value,
	placeholder,
	className,
	displayClassName,
	onSubmit,
}: EditableTextProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(value);

	const handleCommit = () => {
		const trimmed = draft.trim();
		if (!trimmed) {
			setDraft(value);
			setIsEditing(false);
			return;
		}
		if (trimmed !== value) {
			onSubmit(trimmed);
		}
		setIsEditing(false);
	};

	if (isEditing) {
		return (
			<Input
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={handleCommit}
				onKeyDown={(e) => {
					if (e.key === "Enter") handleCommit();
					if (e.key === "Escape") {
						setDraft(value);
						setIsEditing(false);
					}
				}}
				className={className}
				autoFocus
			/>
		);
	}

	return (
		<button
			type="button"
			className={displayClassName}
			onClick={() => setIsEditing(true)}
		>
			{value || placeholder}
		</button>
	);
}
