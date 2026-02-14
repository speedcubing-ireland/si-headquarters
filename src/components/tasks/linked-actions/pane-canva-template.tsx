import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Share2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { TaskLinkedAction } from "@/data/types-new";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CanvaTemplatePaneProps {
	item: TaskLinkedAction;
	isRunning: boolean;
	isReadOnly: boolean;
	isConfirming: boolean;
	isLinking: boolean;
	onRun: () => void;
	onConfirmManualShare: () => void;
	onManualLink: (designInput: string) => Promise<boolean>;
}

function parseOutput(outputJson: string | null): {
	designId: string | null;
	url: string | null;
	previewImageUrl: string | null;
} | null {
	if (!outputJson) return null;
	try {
		const parsed = JSON.parse(outputJson) as {
			designId?: string;
			url?: string;
			previewImageUrl?: string;
			preview_image_url?: string;
		};
		return {
			designId: parsed.designId ?? null,
			url: parsed.url ?? null,
			previewImageUrl:
				parsed.previewImageUrl ?? parsed.preview_image_url ?? null,
		};
	} catch (error) {
		console.warn("Failed to parse linked action output JSON.", { error });
		return { designId: null, url: null, previewImageUrl: null };
	}
}

export function CanvaTemplatePane({
	item,
	isRunning,
	isReadOnly,
	isConfirming,
	isLinking,
	onRun,
	onConfirmManualShare,
	onManualLink,
}: CanvaTemplatePaneProps) {
	const getDesignMetadata = useAction(api.canva.getDesignMetadata);
	const validateDesignInput = useAction(api.canva.validateDesignInput);
	const output = parseOutput(item.lastOutputJson);
	const designId = output?.designId ?? null;
	const [liveMetadata, setLiveMetadata] = useState<{
		url: string | null;
		previewImageUrl: string | null;
	} | null>(null);

	useEffect(() => {
		let isCancelled = false;
		if (!designId) {
			setLiveMetadata(null);
			return;
		}
		void getDesignMetadata({
			designId,
			taskId: item.taskId,
			taskLinkedActionId: item.id,
		})
			.then((metadata) => {
				if (isCancelled) return;
				setLiveMetadata({
					url: metadata.url,
					previewImageUrl: metadata.previewImageUrl,
				});
			})
			.catch((error) => {
				if (isCancelled) return;
				console.warn("Failed to fetch Canva design metadata.", {
					designId,
					taskId: item.taskId,
					taskLinkedActionId: item.id,
					error,
				});
				setLiveMetadata(null);
			});
		return () => {
			isCancelled = true;
		};
	}, [designId, getDesignMetadata, item.id, item.taskId]);

	const outputUrl = liveMetadata?.url ?? output?.url ?? null;
	const previewImageUrl =
		liveMetadata?.previewImageUrl ?? output?.previewImageUrl ?? null;
	const hasLinkedDesign = Boolean(designId || output?.url);
	const isAwaitingShare = item.status === "awaiting_manual_share";
	const [manualDialogOpen, setManualDialogOpen] = useState(false);
	const [manualInput, setManualInput] = useState("");
	const [manualError, setManualError] = useState<string | null>(null);
	const [isValidatingManual, setIsValidatingManual] = useState(false);
	const [manualCandidate, setManualCandidate] = useState<{
		id: string;
		title: string;
		url: string;
		previewImageUrl: string | null;
	} | null>(null);

	const onManualDialogOpenChange = (open: boolean) => {
		setManualDialogOpen(open);
		if (!open) {
			setManualInput("");
			setManualError(null);
			setManualCandidate(null);
		}
	};

	const validateManualDesign = () => {
		setManualError(null);
		setManualCandidate(null);
		setIsValidatingManual(true);
		void validateDesignInput({
			value: manualInput,
			taskId: item.taskId,
			taskLinkedActionId: item.id,
		})
			.then((design) => {
				setManualCandidate(design);
			})
			.catch((error) => {
				setManualError(
					error instanceof Error
						? error.message
						: "Could not validate Canva design link.",
				);
			})
			.finally(() => setIsValidatingManual(false));
	};

	const attachManualDesign = () => {
		if (!manualCandidate) return;
		void onManualLink(manualCandidate.id).then((linked) => {
			if (linked) onManualDialogOpenChange(false);
		});
	};

	return (
		<div className="space-y-4">
			{previewImageUrl ? (
				<div className="overflow-hidden rounded-lg border border-border/70 bg-muted/20 p-2">
					<img
						src={previewImageUrl}
						alt="Canva preview"
						className="max-h-[26rem] w-full object-contain"
					/>
				</div>
			) : null}
			{!hasLinkedDesign ? (
				<div className="flex flex-wrap items-center gap-2">
					<Button size="sm" onClick={onRun} disabled={isRunning || isReadOnly}>
						{isRunning ? <Loader2 className="size-4 animate-spin" /> : null}
						Create From Template
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={() => onManualDialogOpenChange(true)}
						disabled={isRunning || isReadOnly || isLinking}
					>
						{isLinking ? <Loader2 className="size-4 animate-spin" /> : null}
						Manual Link
					</Button>
				</div>
			) : null}
			{isAwaitingShare ? (
				<div className="rounded-lg border border-accent bg-accent/30 p-3">
					<div className="mb-2 flex items-center gap-2 text-xs font-medium text-accent-foreground">
						<Share2 className="size-3.5" />
						Manual sharing required
					</div>
					<p className="text-xs text-accent-foreground">
						Open the generated design and set sharing to anyone with the link
						can edit if needed. Then confirm below.
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						{outputUrl ? (
							<Button asChild variant="outline" size="sm">
								<a href={outputUrl} target="_blank" rel="noreferrer">
									<ExternalLink className="size-3.5" />
									Open design
								</a>
							</Button>
						) : null}
						<Button
							size="sm"
							onClick={onConfirmManualShare}
							disabled={isReadOnly || isConfirming}
						>
							{isConfirming ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							I set sharing
						</Button>
					</div>
				</div>
			) : null}
			{outputUrl && !isAwaitingShare ? (
				<Button asChild variant="outline" size="sm">
					<a href={outputUrl} target="_blank" rel="noreferrer">
						<ExternalLink className="size-3.5" />
						Open design
					</a>
				</Button>
			) : null}

			<ResponsiveModal
				open={manualDialogOpen}
				onOpenChange={onManualDialogOpenChange}
				dialogContentClassName="sm:max-w-[540px]"
				sheetContentClassName="p-6"
			>
					<DialogHeader>
						<DialogTitle>Link Existing Canva Design</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<div className="space-y-1.5">
							<Label htmlFor={`canva-manual-link-${item.id}`}>
								Design URL or ID
							</Label>
							<Input
								id={`canva-manual-link-${item.id}`}
								value={manualInput}
								onChange={(event) => setManualInput(event.target.value)}
								placeholder="https://www.canva.com/design/..."
								disabled={isValidatingManual || isLinking}
							/>
							{manualError ? (
								<p className="text-xs text-destructive">{manualError}</p>
							) : null}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={validateManualDesign}
								disabled={
									manualInput.trim().length === 0 ||
									isValidatingManual ||
									isLinking
								}
							>
								{isValidatingManual ? (
									<Loader2 className="size-4 animate-spin" />
								) : null}
								Validate
							</Button>
							<Button
								type="button"
								size="sm"
								onClick={attachManualDesign}
								disabled={!manualCandidate || isValidatingManual || isLinking}
							>
								{isLinking ? <Loader2 className="size-4 animate-spin" /> : null}
								Use Design
							</Button>
						</div>
						{manualCandidate ? (
							<div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
								<p className="text-sm font-medium">{manualCandidate.title}</p>
								{manualCandidate.previewImageUrl ? (
									<div className="overflow-hidden rounded-md border border-border/70 bg-background p-2">
										<img
											src={manualCandidate.previewImageUrl}
											alt={`${manualCandidate.title} preview`}
											className="max-h-[22rem] w-full object-contain"
										/>
									</div>
								) : null}
								<Button asChild size="sm" variant="outline">
									<a
										href={manualCandidate.url}
										target="_blank"
										rel="noreferrer"
									>
										<ExternalLink className="size-3.5" />
										Open design
									</a>
								</Button>
							</div>
						) : null}
					</div>
			</ResponsiveModal>
		</div>
	);
}
