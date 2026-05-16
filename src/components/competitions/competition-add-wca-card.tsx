import { useAction } from "convex/react";
import { Globe, Loader2, Search } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { WcaSearchResult } from "@/components/competitions/competition-detail-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import type { Competition } from "@/data/types-new";
import { useCompetitionMutations } from "@/hooks/use-convex-data";
import { onMutationError } from "@/lib/utils";

function WcaSearchResults({
	items,
	linkingId,
	onLink,
}: {
	items: WcaSearchResult[];
	linkingId: string | null;
	onLink: (result: WcaSearchResult) => void;
}) {
	if (items.length === 0) return null;

	return (
		<div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
			{items.map((result) => (
				<button
					type="button"
					key={result.id}
					disabled={linkingId === result.id}
					className="rounded-md px-2 py-2 text-left hover:bg-accent disabled:opacity-50"
					onClick={() => onLink(result)}
				>
					<div className="font-medium leading-tight">{result.name}</div>
					<div className="text-xs text-muted-foreground">
						{result.city} - {result.start_date}
					</div>
				</button>
			))}
		</div>
	);
}

export function CompetitionAddWcaCard({
	competition,
}: {
	competition: Competition;
}) {
	const { updateCompetition } = useCompetitionMutations();
	const searchWcaCompetitions = useAction(
		api.integrations.wca.actions.searchCompetitions,
	);
	const fetchMyWcaCompetitions = useAction(
		api.integrations.wca.actions.fetchMyCompetitions,
	);
	const [wcaSearchQuery, setWcaSearchQuery] = useState("");
	const [wcaSearchResults, setWcaSearchResults] = useState<WcaSearchResult[]>(
		[],
	);
	const [wcaMyComps, setWcaMyComps] = useState<WcaSearchResult[]>([]);
	const [wcaMyCompsLoaded, setWcaMyCompsLoaded] = useState(false);
	const [wcaSearching, setWcaSearching] = useState(false);
	const [wcaPopoverOpen, setWcaPopoverOpen] = useState(false);
	const [wcaLinking, setWcaLinking] = useState<string | null>(null);
	const [wcaSearchAll, setWcaSearchAll] = useState(false);

	const resetWcaSearch = useCallback(() => {
		setWcaSearchQuery("");
		setWcaSearchResults([]);
		setWcaSearchAll(false);
	}, []);

	const handleSearchAll = useCallback(() => {
		const query = wcaSearchQuery.trim();
		if (!query) return;
		setWcaSearching(true);
		void searchWcaCompetitions({ query })
			.then((results) => {
				setWcaSearchResults(results as WcaSearchResult[]);
			})
			.catch((error) => {
				console.warn("Failed to search WCA competitions.", { query, error });
				toast.error("Failed to search WCA competitions");
			})
			.finally(() => setWcaSearching(false));
	}, [searchWcaCompetitions, wcaSearchQuery]);

	const handleLinkWcaCompetition = useCallback(
		(result: WcaSearchResult) => {
			setWcaLinking(result.id);
			void updateCompetition(competition.id, {
				wcaCompetitionId: result.id,
				wcaCompetitionName: result.name,
			})
				.then(() => {
					setWcaPopoverOpen(false);
					resetWcaSearch();
					toast.success(`Linked to ${result.name}`);
				})
				.catch(onMutationError)
				.finally(() => setWcaLinking(null));
		},
		[competition.id, resetWcaSearch, updateCompetition],
	);

	const visibleWcaItems = wcaSearchAll
		? wcaSearchResults
		: wcaMyComps.filter(
				(result) =>
					!wcaSearchQuery.trim() ||
					result.name
						.toLowerCase()
						.includes(wcaSearchQuery.trim().toLowerCase()),
			);

	return (
		<div className="rounded-md border border-dashed bg-muted/15 p-3">
			<div className="flex items-start gap-3">
				<div className="rounded-md border bg-background p-2">
					<Globe className="size-4 text-info" />
				</div>
				<div className="min-w-0 flex-1 pt-1 font-medium">WCA listing</div>
			</div>
			<Popover
				open={wcaPopoverOpen}
				onOpenChange={(open) => {
					setWcaPopoverOpen(open);
					if (open && !wcaMyCompsLoaded) {
						setWcaSearching(true);
						void fetchMyWcaCompetitions({})
							.then((results) => {
								setWcaMyComps(results as WcaSearchResult[]);
								setWcaMyCompsLoaded(true);
							})
							.catch((error) => {
								console.warn("Failed to load WCA competitions.", { error });
								toast.error("Failed to load your WCA competitions");
							})
							.finally(() => setWcaSearching(false));
					}
					if (!open) resetWcaSearch();
				}}
			>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="mt-3">
						Link WCA competition
					</Button>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className="w-[min(22rem,calc(100vw-1.5rem))] p-3"
				>
					<PopoverHeader className="p-0 pb-2">
						<PopoverTitle className="text-xs font-medium">
							{wcaSearchAll
								? "Search all WCA competitions"
								: "My WCA competitions"}
						</PopoverTitle>
					</PopoverHeader>
					<div className="flex gap-2">
						<Input
							placeholder={
								wcaSearchAll
									? "Search all competitions..."
									: "Filter my competitions..."
							}
							value={wcaSearchQuery}
							onChange={(e) => {
								setWcaSearchQuery(e.target.value);
								if (!wcaSearchAll) setWcaSearchResults([]);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" && wcaSearchAll) {
									handleSearchAll();
								}
							}}
							className="h-9 flex-1"
						/>
						{wcaSearchAll ? (
							<Button
								size="sm"
								className="h-9"
								disabled={!wcaSearchQuery.trim() || wcaSearching}
								onClick={handleSearchAll}
							>
								{wcaSearching ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<Search className="size-3.5" />
								)}
							</Button>
						) : null}
					</div>
					{wcaSearching && !wcaMyCompsLoaded ? (
						<div className="mt-3 flex items-center justify-center">
							<Loader2 className="size-4 animate-spin text-muted-foreground" />
						</div>
					) : null}
					{visibleWcaItems.length > 0 || wcaSearching ? (
						<WcaSearchResults
							items={visibleWcaItems}
							linkingId={wcaLinking}
							onLink={handleLinkWcaCompetition}
						/>
					) : null}
					<button
						type="button"
						className="mt-3 text-xs text-muted-foreground hover:text-foreground"
						onClick={() => {
							setWcaSearchAll(!wcaSearchAll);
							setWcaSearchQuery("");
							setWcaSearchResults([]);
						}}
					>
						{wcaSearchAll
							? "Back to my competitions"
							: "Search all competitions"}
					</button>
				</PopoverContent>
			</Popover>
		</div>
	);
}
