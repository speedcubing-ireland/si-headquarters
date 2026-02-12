import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SettingsSectionProps = {
	title: string;
	description?: string;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
};

export function SettingsSection({
	title,
	description,
	actions,
	children,
	className,
}: SettingsSectionProps) {
	return (
		<section
			className={cn(
				"rounded-xl border border-border/70 bg-background p-4 sm:p-5",
				className,
			)}
		>
			<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="text-sm font-semibold">{title}</h2>
					{description ? (
						<p className="text-xs text-muted-foreground">{description}</p>
					) : null}
				</div>
				{actions}
			</div>
			{children}
		</section>
	);
}
