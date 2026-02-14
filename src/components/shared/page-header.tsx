import type { LucideIcon } from "lucide-react";
import { LayersPlus } from "lucide-react";
import { useState } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";
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

function PageHeaderRoot({
	children,
	className,
	withBottomBorder = true,
}: {
	children: React.ReactNode;
	className?: string;
	withBottomBorder?: boolean;
}) {
	return (
		<header
			className={cn(
				"flex min-h-14 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:min-h-12 sm:min-h-12",
				withBottomBorder && "border-b",
				className,
			)}
		>
			<div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 px-3 py-2 sm:px-4 lg:gap-2 lg:px-6">
				{children}
			</div>
		</header>
	);
}

function PageHeaderDivider({ className }: { className?: string }) {
	return (
		<Separator
			orientation="vertical"
			className={cn(
				"hidden data-[orientation=vertical]:h-3 sm:block",
				className,
			)}
		/>
	);
}

function PageHeaderPrimary({
	icon: Icon,
	label,
	onClick,
}: {
	icon: LucideIcon;
	label: string;
	onClick?: () => void;
}) {
	return (
		<Button variant="outline" size="sm" onClick={onClick} className="min-w-0">
			<Icon className="size-4" />
			<span className="truncate">{label}</span>
		</Button>
	);
}

function PageHeaderSecondary({ label }: { label: string }) {
	return <span className="text-xs text-muted-foreground">{label}</span>;
}

function PageHeaderViews({
	views,
	activeViewId,
	onViewSelect,
	onViewDelete,
}: {
	views: SavedView[];
	activeViewId: string | null;
	onViewSelect: (viewId: string) => void;
	onViewDelete: (viewId: string) => void;
}) {
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

	if (views.length === 0) return null;

	return (
		<>
			<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
				{views.map((view) => (
					<ContextMenu key={view.id}>
						<ContextMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								onClick={() => onViewSelect(view.id)}
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
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete view?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete this saved view. This cannot be
							undone.
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

function PageHeaderNewView({
	onClick,
	showLabel = false,
}: {
	onClick: () => void;
	showLabel?: boolean;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={onClick}
			title="New view"
			className={cn("shrink-0", showLabel && "sm:h-8 sm:w-auto sm:px-2.5")}
		>
			<LayersPlus className="size-4" />
			{showLabel ? <span className="hidden sm:inline">New view</span> : null}
		</Button>
	);
}

function PageHeaderActions({ children }: { children: React.ReactNode }) {
	return (
		<div className="ml-auto flex shrink-0 items-center justify-end gap-2">
			{children}
		</div>
	);
}

interface AppPageHeaderProps {
	title: string;
	subtitle?: string;
	actions?: React.ReactNode;
	withBottomBorder?: boolean;
}

export function AppPageHeader({
	title,
	subtitle,
	actions,
	withBottomBorder = false,
}: AppPageHeaderProps) {
	return (
		<PageHeader.Root withBottomBorder={withBottomBorder}>
			<SidebarTrigger className="-ml-1 shrink-0" />
			<PageHeader.Divider className="mr-2" />
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbPage>{title}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			{subtitle && (
				<>
					<PageHeader.Divider className="mx-2" />
					<span className="hidden text-xs text-muted-foreground sm:inline">
						{subtitle}
					</span>
				</>
			)}
			{actions ? <PageHeader.Actions>{actions}</PageHeader.Actions> : null}
		</PageHeader.Root>
	);
}

export const PageHeader = {
	Root: PageHeaderRoot,
	Divider: PageHeaderDivider,
	Primary: PageHeaderPrimary,
	Secondary: PageHeaderSecondary,
	Views: PageHeaderViews,
	NewView: PageHeaderNewView,
	Actions: PageHeaderActions,
};

interface SharedPageHeaderProps {
	primaryIcon: LucideIcon;
	primaryLabel: string;
	secondaryLabel?: string;
	addIcon?: LucideIcon;
	addLabel?: string;
	onAdd?: () => void;
	onPrimaryClick?: () => void;
	views?: SavedView[];
	activeViewId?: string | null;
	onViewSelect?: (viewId: string) => void;
	onViewDelete?: (viewId: string) => void;
	onStartCreateView?: () => void;
	extraActions?: React.ReactNode;
}

export function SharedPageHeader({
	primaryIcon: PrimaryIcon,
	primaryLabel,
	secondaryLabel,
	addIcon,
	addLabel,
	onAdd,
	onPrimaryClick,
	views = [],
	activeViewId = null,
	onViewSelect,
	onViewDelete,
	onStartCreateView,
	extraActions,
}: SharedPageHeaderProps) {
	let addButton: React.ReactNode = null;
	if (addIcon && addLabel && onAdd) {
		const Icon = addIcon;
		addButton = (
			<Button variant="ghost" size="sm" onClick={onAdd}>
				<Icon className="size-4" />
				<span className="hidden sm:inline">{addLabel}</span>
			</Button>
		);
	}

	return (
		<PageHeader.Root>
			<SidebarTrigger className="shrink-0" />
			<PageHeader.Primary
				icon={PrimaryIcon}
				label={primaryLabel}
				onClick={onPrimaryClick}
			/>
			{secondaryLabel && (
				<>
					<Separator
						orientation="vertical"
						className="mx-2 hidden data-[orientation=vertical]:h-4 sm:block"
					/>
					<PageHeader.Secondary label={secondaryLabel} />
				</>
			)}
			{(views.length > 0 || onStartCreateView) && (
				<>
					<Separator
						orientation="vertical"
						className="mx-2 hidden data-[orientation=vertical]:h-4 sm:block"
					/>
					{views.length > 0 && onViewSelect && onViewDelete && (
						<PageHeader.Views
							views={views}
							activeViewId={activeViewId ?? null}
							onViewSelect={onViewSelect}
							onViewDelete={onViewDelete}
						/>
					)}
					{onStartCreateView && (
						<PageHeader.NewView
							onClick={onStartCreateView}
							showLabel={views.length === 0}
						/>
					)}
				</>
			)}
			<PageHeader.Actions>
				{addButton}
				{extraActions}
			</PageHeader.Actions>
		</PageHeader.Root>
	);
}
