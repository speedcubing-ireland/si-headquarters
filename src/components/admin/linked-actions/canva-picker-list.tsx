import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CanvaPickerListRow = {
	id: string;
	title: string;
	subtitle?: string;
	meta?: string;
};

interface CanvaPickerListProps {
	rows: CanvaPickerListRow[];
	isLoading: boolean;
	isLoadingMore: boolean;
	error: string | null;
	hasMore: boolean;
	emptyLabel: string;
	onLoadMore: () => void;
	onSelect?: (row: CanvaPickerListRow) => void;
	selectLabel?: string;
	renderActions?: (row: CanvaPickerListRow) => ReactNode;
}

export function CanvaPickerList({
	rows,
	isLoading,
	isLoadingMore,
	error,
	hasMore,
	emptyLabel,
	onLoadMore,
	onSelect,
	selectLabel = "Select",
	renderActions,
}: CanvaPickerListProps) {
	if (isLoading) {
		return (
			<div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
				<Loader2 className="size-4 animate-spin" />
				Loading...
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
				{error}
			</div>
		);
	}

	if (rows.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
				{emptyLabel}
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<div className="max-h-80 space-y-2 overflow-y-auto pr-1">
				{rows.map((row) => (
					<div
						key={row.id}
						className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
					>
						<div className="min-w-0">
							<p className="truncate text-sm font-medium">{row.title}</p>
							{row.subtitle ? (
								<p className="truncate text-xs text-muted-foreground">
									{row.subtitle}
								</p>
							) : null}
							{row.meta ? (
								<p className="truncate text-[11px] text-muted-foreground">
									{row.meta}
								</p>
							) : null}
						</div>
						<div className="flex shrink-0 items-center gap-2">
							{renderActions ? renderActions(row) : null}
							{onSelect ? (
								<Button size="sm" onClick={() => onSelect(row)}>
									{selectLabel}
								</Button>
							) : null}
						</div>
					</div>
				))}
			</div>
			{hasMore ? (
				<Button
					variant="outline"
					size="sm"
					disabled={isLoadingMore}
					onClick={onLoadMore}
				>
					{isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
					Load more
				</Button>
			) : null}
		</div>
	);
}
