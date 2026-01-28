import type { LucideIcon } from "lucide-react";
import { LayersPlus } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { SavedView } from "@/store/saved-views-store";

interface SharedPageHeaderProps {
	primaryIcon: LucideIcon;
	primaryLabel: string;
	addIcon: LucideIcon;
	addLabel: string;
	onAdd: () => void;
	onPrimaryClick?: () => void;
	views?: SavedView[];
	activeViewId?: string | null;
	onViewSelect?: (viewId: string) => void;
	onViewDelete?: (viewId: string) => void;
	onStartCreateView?: () => void;
}

export function SharedPageHeader({
	primaryIcon: PrimaryIcon,
	primaryLabel,
	addIcon: AddIcon,
	addLabel,
	onAdd,
	onPrimaryClick,
	views = [],
	activeViewId = null,
	onViewSelect,
	onViewDelete,
	onStartCreateView,
}: SharedPageHeaderProps) {
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [viewToDelete, setViewToDelete] = useState<string | null>(null);

	const handleDeleteClick = (viewId: string) => {
		setViewToDelete(viewId);
		setDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = () => {
		if (viewToDelete && onViewDelete) {
			onViewDelete(viewToDelete);
		}
		setDeleteDialogOpen(false);
		setViewToDelete(null);
	};

	return (
		<>
			<header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
				<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
					<Button variant="outline" size="sm" onClick={onPrimaryClick}>
						<PrimaryIcon className="size-4" />
						{primaryLabel}
					</Button>
					<Separator
						orientation="vertical"
						className="mx-2 data-[orientation=vertical]:h-4"
					/>
					{views.length > 0 && (
						<div className="flex items-center gap-1">
							{views.map((view) => (
								<ContextMenu key={view.id}>
									<ContextMenuTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											onClick={() => onViewSelect?.(view.id)}
											className={cn(
												"relative",
												activeViewId === view.id && "bg-muted font-medium",
											)}
										>
											{view.name}
										</Button>
									</ContextMenuTrigger>
									<ContextMenuContent>
										<ContextMenuItem
											variant="destructive"
											onSelect={() => handleDeleteClick(view.id)}
										>
											Delete
										</ContextMenuItem>
									</ContextMenuContent>
								</ContextMenu>
							))}
						</div>
					)}
					{onStartCreateView && (
						<Button
							variant="ghost"
							size={views.length > 0 ? "icon" : "sm"}
							onClick={onStartCreateView}
							title="New view"
						>
							<LayersPlus className="size-4" />
							{views.length === 0 && "New view"}
						</Button>
					)}
					<div className="ml-auto flex items-center gap-2">
						<Button variant="ghost" size="sm" onClick={onAdd}>
							<AddIcon className="size-4" />
							{addLabel}
						</Button>
						<SidebarTrigger />
					</div>
				</div>
			</header>
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete view?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete this saved view. This action cannot
							be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={handleDeleteConfirm}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
