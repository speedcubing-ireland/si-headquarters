import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Trophy, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDataV2 } from "@/data/data-store-v2";

export function ActiveCompetitionsWidget() {
	const competitions = useDataV2((state) => state.competitions);

	const activeCompetitions = useMemo(() => {
		const today = new Date().toISOString().split("T")[0];
		return competitions.filter((c) => c.compEnd >= today);
	}, [competitions]);

	const phaseBreakdown = useMemo(() => {
		const breakdown: Record<string, number> = {};
		for (const comp of activeCompetitions) {
			const phaseName = comp.phases[comp.currentPhaseIdx]?.name || "Unknown";
			breakdown[phaseName] = (breakdown[phaseName] || 0) + 1;
		}
		return breakdown;
	}, [activeCompetitions]);

	const total = activeCompetitions.length;

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Trophy className="size-4 text-muted-foreground" />
					Active Competitions
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold mb-4">{total}</div>

				{total > 0 && (
					<div className="space-y-2">
						{Object.entries(phaseBreakdown).map(([phase, count]) => {
							const percentage = (count / total) * 100;
							return (
								<div key={phase} className="space-y-1">
									<div className="flex justify-between text-xs">
										<span className="text-muted-foreground">{phase}</span>
										<span className="font-medium">{count}</span>
									</div>
									<div className="h-1.5 bg-muted rounded-full overflow-hidden">
										<div
											className="h-full bg-primary rounded-full transition-all"
											style={{ width: `${percentage}%` }}
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}

				<Link
					to="/competitions"
					className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-4 pt-3 border-t"
				>
					View all competitions
					<ArrowRight className="size-3" />
				</Link>
			</CardContent>
		</Card>
	);
}
