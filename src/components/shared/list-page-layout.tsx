import { createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface CreateViewState {
	isCreatingView: boolean;
	viewName: string;
	setViewName: (v: string) => void;
	viewDescription: string;
	setViewDescription: (v: string) => void;
	onCancelCreateView: () => void;
	onSaveView: () => void;
}

const CreateViewContext = createContext<CreateViewState | null>(null);

export function CreateViewProvider({
	value,
	children,
}: {
	value: CreateViewState;
	children: React.ReactNode;
}) {
	return (
		<CreateViewContext.Provider value={value}>
			{children}
		</CreateViewContext.Provider>
	);
}

export interface ListPageLayoutProps {
	header: React.ReactNode;
	filtersRow: React.ReactNode;
	table: React.ReactNode;
	modal: React.ReactNode;
}

export function ListPageLayout({
	header,
	filtersRow,
	table,
	modal,
}: ListPageLayoutProps) {
	const createView = useContext(CreateViewContext);
	const isCreatingView = createView?.isCreatingView ?? false;
	const viewName = createView?.viewName ?? "";
	const setViewName = createView?.setViewName ?? (() => {});
	const viewDescription = createView?.viewDescription ?? "";
	const setViewDescription = createView?.setViewDescription ?? (() => {});
	const onCancelCreateView = createView?.onCancelCreateView ?? (() => {});
	const onSaveView = createView?.onSaveView ?? (() => {});

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			{header}
			{createView && isCreatingView ? (
				<div className="flex min-h-12 shrink-0 flex-col gap-3 border-b bg-background py-3 px-4 lg:px-6">
					<div className="flex items-start gap-4">
						<div className="flex flex-1 flex-col gap-2">
							<Input
								placeholder="View name"
								value={viewName}
								onChange={(e) => setViewName(e.target.value)}
								className="h-8 text-sm font-medium"
							/>
							<Textarea
								placeholder="Description (optional)"
								value={viewDescription}
								onChange={(e) => setViewDescription(e.target.value)}
								className="min-h-[60px] resize-none text-sm"
							/>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<Button variant="outline" size="sm" onClick={onCancelCreateView}>
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={onSaveView}
								disabled={!viewName.trim()}
							>
								Save view
							</Button>
						</div>
					</div>
					<div className="flex w-full items-center gap-2">{filtersRow}</div>
				</div>
			) : (
				<div className="flex min-h-12 shrink-0 items-center gap-2 border-b py-2">
					<div className="flex w-full items-center gap-2 px-4 lg:px-6">
						{filtersRow}
					</div>
				</div>
			)}
			<div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
				{table}
			</div>
			{modal}
		</div>
	);
}
